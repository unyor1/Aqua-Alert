import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { WaterLevelGauge } from "../components/WaterLevelGauge";
import { AlertTriangle, Droplets, TrendingUp, Clock, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { supabase } from "../../utils/supabase/client";

interface WaterReading {
  timestamp: Date;
  level: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [currentLevel, setCurrentLevel] = useState(85);
  const [userName, setUserName] = useState<string | null>(null);
  const [readings, setReadings] = useState<WaterReading[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    

    let isMounted = true;

    const loadReadings = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Supabase session error:", sessionError);
        }

        if (!sessionData?.session) {
          navigate("/login");
          return;
        }

        // set user name for welcome message
        const user = sessionData.session.user;
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Failed to load profile:", profileError);
        }

        if (!profileError && profile?.username) {
          setUserName(profile.username);
        } else {
          const nameFromMeta = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name;
          if (nameFromMeta) setUserName(nameFromMeta);
          else if (user?.email) setUserName(user.email.split("@")[0]);
        }

        const { data: logs, error: logsError } = await supabase
          .from("sensor_logs")
          .select("created_at, water_level")
          .order("created_at", { ascending: false })
          .limit(100);

        if (logsError) {
          console.error("Failed to load sensor_logs:", logsError);
          return;
        }

        if (!logs) {
          // No data returned but no explicit error — clear readings to indicate empty state
          if (isMounted) setReadings([]);
          return;
        }

        const parsedReadings = logs
          .map((log) => ({
            timestamp: new Date(log.created_at),
            level: log.water_level,
          }))
          .reverse();

        if (isMounted) {
          setReadings(parsedReadings);
          if (parsedReadings.length > 0) {
            setCurrentLevel(parsedReadings[parsedReadings.length - 1].level);
            setLastUpdate(parsedReadings[parsedReadings.length - 1].timestamp);
          }
        }
      } catch (err) {
        console.error("Unexpected error loading readings:", err);
      }
    };

    void loadReadings();
    const interval = setInterval(loadReadings, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [navigate]);

  const getAlertLevel = (level: number) => {
    if (level > 100) return { severity: "critical", color: "destructive" };
    if (level === 100) return { severity: "warning", color: "default" };
    return { severity: "normal", color: "default" };
  };

  // Clamp all readings to 0-100 cm and reverse for display
  const clampedReadings = readings.map(r => ({
    ...r,
    level: Math.max(0, Math.min(100, r.level)),
  }));
  // Reverse the current level and readings for display
  const reversedCurrentLevel = 100 - Math.max(0, Math.min(100, currentLevel));
  const alert = getAlertLevel(reversedCurrentLevel);
  const reversedReadings = clampedReadings.map(r => ({ ...r, level: 100 - r.level }));
  const displayedReadings = reversedReadings.slice().reverse(); // newest first
  const averageLevel = reversedReadings.length > 0 
    ? Math.round(reversedReadings.reduce((sum, r) => sum + r.level, 0) / reversedReadings.length)
    : 0;

  return (
    <div className="min-h-full bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Flood Monitoring Dashboard</h1>
          <p className="text-gray-600">Real-time water level monitoring and alerts</p>
          <div className="mt-3">
            <div className="inline-flex items-center gap-3 bg-sky-50 border border-sky-200 text-sky-800 px-3 py-2 rounded-md shadow-sm">
              <User className="w-5 h-5 text-sky-700" />
              <div>
                <div className="text-sm font-medium">Welcome{userName ? `, ${userName}` : ""} 👋</div>
                <div className="text-xs text-sky-600">Glad to see you back — here's the latest.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Section */}
        {alert.severity !== "normal" && (
          <Alert variant={alert.color as any} className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {alert.severity === "critical" ? "Critical Alert!" : "Warning"}
            </AlertTitle>
            <AlertDescription>
              {alert.severity === "critical" 
                ? "Water level is at critical threshold. Immediate action recommended."
                : "Water level is elevated. Continue monitoring closely."}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Current Level Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-600" />
                Current Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600">{Math.round(reversedCurrentLevel)} cm</div>
              <p className="text-sm text-gray-500 mt-2">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>

          {/* Average Level Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Average Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{averageLevel} cm</div>
              <p className="text-sm text-gray-500 mt-2">
                Based on {readings.length} readings
              </p>
         
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Water Level Gauge */}
          <Card>
            <CardHeader>
              <CardTitle>Water Level Gauge</CardTitle>
              <CardDescription>Visual representation of current water level</CardDescription>
            </CardHeader>
            <CardContent>
              <WaterLevelGauge level={Math.round(reversedCurrentLevel)} />
            </CardContent>
          </Card>

          {/* Recent Readings */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Readings</CardTitle>
              <CardDescription>Latest measurements (scroll to view all)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {displayedReadings.length > 0 ? (
                  displayedReadings.map((reading, index) => (
                    <div 
                      key={index} 
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm text-gray-500">
                          {reading.timestamp.toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {reading.timestamp.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-xl font-bold text-blue-600">
                        {reading.level} cm
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No readings yet. Monitoring will begin shortly.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}