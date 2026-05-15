import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const userClient = (authHeader: string) =>
  createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

const adminClient = () => createClient(supabaseUrl, serviceRoleKey);

const isAdmin = async (admin: ReturnType<typeof adminClient>, userId: string) => {
  const { data, error } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.role === "admin";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = userClient(authHeader);
    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const admin = adminClient();

    if (action === "ban-pending") {
      const userId = body.userId as string | undefined;
      if (!userId || userId !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Invalid user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const username = body.username as string | undefined;
      const email = body.email as string | undefined;

      const { error: upsertError } = await admin
        .from("user_profiles")
        .upsert({
          id: userId,
          username: username ?? "",
          email: email ?? userData.user.email ?? "",
          role: "user",
        });
      if (upsertError) {
        throw new Error(upsertError.message);
      }

      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "87600h",
      });
      if (banError) {
        throw new Error(banError.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve-user") {
      const targetUserId = body.userId as string | undefined;
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminOk = await isAdmin(admin, userData.user.id);
      if (!adminOk) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No profile-level "approved" flag in schema; just unban the user
      const { error: profileError } = await admin
        .from("user_profiles")
        .select("id")
        .eq("id", targetUserId)
        .maybeSingle();
      if (profileError) {
        throw new Error(profileError.message);
      }

      const { error: unbanError } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (unbanError) {
        throw new Error(unbanError.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject-user") {
      const targetUserId = body.userId as string | undefined;
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminOk = await isAdmin(admin, userData.user.id);
      if (!adminOk) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteProfileError } = await admin
        .from("user_profiles")
        .delete()
        .eq("id", targetUserId);
      if (deleteProfileError) {
        throw new Error(deleteProfileError.message);
      }

      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(targetUserId);
      if (deleteAuthError) {
        throw new Error(deleteAuthError.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
