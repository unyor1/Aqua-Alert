import { Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase/client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { AlertTriangle, Bell, BarChart3, Shield } from "lucide-react";

export function Landing() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!mounted) return;
      setIsLoggedIn(!!session);
      const params = new URLSearchParams(window.location.search);

      if (params.get("status") === "rejected") {
        setAlertMessage("Account rejected. Try contacting the admin.");
        return;
      }

      if (session && !params.has("loggedOut")) {
        navigate("/dashboard");
      }
    };
    void check();
    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-full bg-[#F1F5F9]">
      {/* Hero Section */}
      <section className="bg-[#F1F5F9] text-slate-900 py-20">
        <div className="container mx-auto px-4 text-center">
          {alertMessage && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
              {alertMessage}
            </div>
          )}
          <h1 className="text-5xl font-bold mb-6">
            Stay Safe with Real-Time Flood Monitoring
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Monitor water levels in real-time, receive instant alerts, and access historical data to stay ahead of flood risks.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-[#1A53FF] text-white hover:bg-[#174be6] text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" className="bg-white text-[#1A53FF] hover:bg-slate-200 border border-slate-300 text-lg px-8">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-[#F1F5F9]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Comprehensive Flood Monitoring Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold mb-2">Real-Time Monitoring</h3>
                <p className="text-sm text-gray-600">
                  Track water levels in centimeters with live updates and visual indicators.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="font-bold mb-2">Instant Alerts</h3>
                <p className="text-sm text-gray-600">
                  Get notified immediately when water levels reach critical thresholds.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold mb-2">Historical Data</h3>
                <p className="text-sm text-gray-600">
                  Access comprehensive charts and records of past water level measurements.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold mb-2">Safety First</h3>
                <p className="text-sm text-gray-600">
                  Make informed decisions with accurate data to protect your community.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#F1F5F9]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Monitoring?</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join FloodWatch today and gain access to real-time flood monitoring and alerting system.
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8">
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
