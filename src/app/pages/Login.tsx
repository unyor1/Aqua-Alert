import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Droplets, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../utils/supabase/client";

export function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Simple validation
    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }

    const usernameTrimmed = username.trim();
    const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
      "get_email_by_username",
      { _username: usernameTrimmed }
    );

    if (rpcError) {
      setError("Unable to sign in with username. Please contact support.");
      return;
    }

    if (!resolvedEmail) {
      setError("No account found for that username");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail as string,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setError("Login failed. Please try again.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      setError(profileError?.message || "Profile missing");
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
      return;
    }

    navigate("/dashboard");
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      setGoogleLoading(true);
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
      // On success, Supabase will redirect the user to the OAuth consent flow.
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Droplets className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Login to access your flood monitoring dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* removed admin approval pending notice */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Login
            </Button>

            <Button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full mt-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 flex items-center justify-center"
              disabled={googleLoading}
            >
              {googleLoading ? (
                'Signing in...'
              ) : (
                <>
                  <span className="mr-2 flex items-center">
                    <svg className="w-4 h-4" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      <path fill="#4285F4" d="M17.64 9.2045c0-.638-.057-1.25-.164-1.836H9v3.48h4.844c-.21 1.14-.84 2.1-1.788 2.754v2.28h2.89c1.692-1.56 2.698-3.864 2.698-6.678z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.168l-2.89-2.28C11.77 13.03 10.5 13.5 9 13.5c-2.33 0-4.31-1.57-5.02-3.67H1.02v2.31C2.5 15.9 5.5 18 9 18z"/>
                      <path fill="#FBBC05" d="M3.98 10.86c-.22-.66-.35-1.36-.35-2.08s.13-1.42.35-2.08V4.39H1.02A8.994 8.994 0 0 0 0 9.78c0 1.52.35 2.96.99 4.24l2.99-2.16z"/>
                      <path fill="#EA4335" d="M9 3.6c1.32 0 2.5.45 3.43 1.34l2.57-2.57C13.47.92 11.43 0 9 0 5.5 0 2.5 2.1 1.02 4.39l2.99 2.31C4.69 5.17 6.67 3.6 9 3.6z"/>
                    </svg>
                  </span>
                  <span>Sign in with Google</span>
                </>
              )}
            </Button>

            <p className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-600 hover:underline">
                Register here
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
