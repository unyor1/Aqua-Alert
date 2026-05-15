import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../utils/supabase/client";

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Parse tokens from hash (supabase sends tokens in URL hash after redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token) {
      void supabase.auth.setSession({ access_token, refresh_token });
    }
  }, []);

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, a number and a special character");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setNotice("Password reset successful. You can now log in.");
        // sign out to ensure clean state
        await supabase.auth.signOut();
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            {notice && <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm">{notice}</div>}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 p-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">Password must be at least 8 characters and include uppercase, lowercase, a number and a special character.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 p-2"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
