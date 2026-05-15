import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { supabase } from "../../utils/supabase/client";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      // supabase v2: resetPasswordForEmail(email, { redirectTo })
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        setError(error.message);
      } else {
        setNotice("Check your email for password reset instructions.");
        setEmail("");
        // optionally navigate or keep on page
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>Enter your email to receive password reset instructions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            {notice && <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm">{notice}</div>}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Sending..." : "Send reset email"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
