import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../utils/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (active) {
          navigate("/login", { replace: true });
        }
        return;
      }

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      const isMissing = error || !profile;

      if (isMissing) {
        if (active) {
          await supabase.auth.signOut({ scope: "local" });
          navigate("/login", { replace: true });
        }
        return;
      }

      if (adminOnly && profile.role !== "admin") {
        if (active) {
          navigate("/dashboard", { replace: true });
        }
        return;
      }

      if (active) setIsAllowed(true);
    };

    void checkAuth();
    return () => {
      active = false;
    };
  }, [adminOnly, navigate]);

  if (isAllowed === null) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <div className="text-sm text-gray-600">Checking access...</div>
      </div>
    );
  }

  return <>{children}</>;
}
