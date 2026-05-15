import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Droplets, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../utils/supabase/client";

export function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const usernameTrimmed = username.trim();
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must include uppercase, lowercase, a number and a special character and be at least 8 characters long");
      return;
    }

    const { data: existingUsername, error: usernameCheckError } = await supabase.rpc(
      "get_email_by_username",
      { _username: usernameTrimmed }
    );

    if (usernameCheckError) {
      console.warn("Username availability check failed:", usernameCheckError);
    }

    if (existingUsername) {
      setError("That username is already taken. Please choose another.");
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: usernameTrimmed },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      // registration complete — stay on register page and show notice
      setNotice("Account registered. You can log in now. ");
      return;
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
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Register to start monitoring flood alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {notice && !error && (
              <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm">
                {notice}
              </div>
            )}
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
                placeholder="Choose your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

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
              <p className="text-xs text-gray-600 mt-1">
                Password must include uppercase, lowercase, a number and a special character.
              </p>
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

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Create Account
            </Button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                Login here
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
