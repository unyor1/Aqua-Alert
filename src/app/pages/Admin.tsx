import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { supabase } from "../../utils/supabase/client";

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

export function Admin() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      navigate("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, username, email, role, created_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const currentProfile = profileData.find((p) => p.id === session.data.session?.user.id);
    if (!currentProfile || currentProfile.role !== "admin") {
      navigate("/dashboard");
      return;
    }

    setProfiles(profileData || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleDelete = async (userId: string) => {
    setError(null);
    const { error: deleteProfileError } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", userId);
    if (deleteProfileError) {
      setError(deleteProfileError.message);
      return;
    }
    await loadData();
  };

  const totalUsers = profiles.length;

  return (
    <div className="min-h-full bg-gray-50 py-8">
      <div className="container mx-auto px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Control Center</h1>
          <p className="text-gray-600">Manage users and monitor sensors in real time.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
        )}

        <div className="grid md:grid-cols-1 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalUsers}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>List of registered users</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-gray-500">No users found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username || "(no name)"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
