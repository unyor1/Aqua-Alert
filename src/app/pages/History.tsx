import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calendar as CalendarIcon, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";
import { supabase } from "../../utils/supabase/client";

interface WaterReading {
  timestamp: Date;
  level: number;
}

export function History() {
  const navigate = useNavigate();
  const [readings, setReadings] = useState<WaterReading[]>([]);
  const [range, setRange] = useState<{ from?: Date | undefined; to?: Date | undefined } | undefined>(undefined);
  const [appliedRange, setAppliedRange] = useState<typeof range>(undefined);

  const isSameDay = (a?: Date, b?: Date) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const handleDayClick = (day: Date) => {
    // if a single day is selected and user clicks it again, clear selection
    if (range && range.from && !range.to && isSameDay(range.from, day)) {
      setRange(undefined);
      return;
    }
    // otherwise let DayPicker's onSelect update the range
  };

  const handleApply = () => {
    // debug log to confirm click
    // eslint-disable-next-line no-console
    console.log("Apply clicked, current range:", range);
    setApplyAnimating(true);
    setAppliedRange(range);
    // short animation, then stop
    setTimeout(() => setApplyAnimating(false), 600);
  };

  const [applyAnimating, setApplyAnimating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadReadings = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/login");
        return;
      }

        // don't set welcome here; Dashboard will show the welcome message by name

      let query: any = supabase
        .from("sensor_logs")
        .select("created_at, water_level")
        .order("created_at", { ascending: true })
        .limit(1000);

      if (appliedRange && appliedRange.from) {
        query = query.gte("created_at", appliedRange.from.toISOString());
      }
      if (appliedRange && appliedRange.to) {
        const end = new Date(appliedRange.to);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data: logs, error } = await query;
      if (error) {
        console.error("Failed to load readings:", error);
        return;
      }

      if (!logs) return;

      const parsedReadings = logs.map((log: any) => ({
        timestamp: new Date(log.created_at),
        level: log.water_level,
      }));

      if (isMounted) setReadings(parsedReadings);
    };

    void loadReadings();

    return () => {
      isMounted = false;
    };
  }, [navigate, appliedRange]);

  // Prepare chart data
  const chartData = readings.map((reading) => ({
    time: reading.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    level: reading.level,
    date: reading.timestamp.toLocaleDateString(),
  }));

  const maxLevel = readings.length > 0 ? Math.max(...readings.map((r) => r.level)) : 0;
  const minLevel = readings.length > 0 ? Math.min(...readings.map((r) => r.level)) : 0;

  return (
    <div className="min-h-full bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Data History</h1>
            <p className="text-gray-600">Historical water level measurements and trends</p>
            
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                  <CalendarIcon className="w-4 h-4" />
                  {range && range.from ? (
                    <span className="text-sm">
                      {range.from.toLocaleDateString()} {range.to ? `– ${range.to.toLocaleDateString()}` : ""}
                    </span>
                  ) : appliedRange && appliedRange.from ? (
                    <span className="text-sm">
                      {appliedRange.from.toLocaleDateString()} {appliedRange.to ? `– ${appliedRange.to.toLocaleDateString()}` : ""}
                    </span>
                  ) : (
                    <span className="text-sm">Filter dates</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <div className="p-3">
                  <Calendar
                    mode="range"
                    selected={range as any}
                    onSelect={(r) => setRange(r as any)}
                    onDayClick={(d: any) => handleDayClick(d as Date)}
                    disabled={{ after: new Date() }}
                  />
                  <div className="flex justify-between mt-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRange(undefined);
                      }}
                    >
                      Clear
                    </Button>
                    <Button onClick={handleApply} disabled={applyAnimating}>
                      {applyAnimating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Applying...</span>
                        </>
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Maximum Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{maxLevel} cm</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Minimum Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{minLevel} cm</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {readings.length > 0 ? Math.round(readings.reduce((sum, r) => sum + r.level, 0) / readings.length) : 0} cm
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Area Chart */}
        {readings.length > 0 ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Water Level Trend
                </CardTitle>
                <CardDescription>Area chart showing water level changes over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis label={{ value: "Water Level (cm)", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border rounded-lg shadow-lg">
                              <p className="text-sm font-medium">{payload[0].payload.date}</p>
                              <p className="text-sm">{payload[0].payload.time}</p>
                              <p className="text-sm font-bold text-blue-600">Level: {payload[0].value} cm</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="level" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} name="Water Level (cm)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">No Data Available</h3>
              <p className="text-gray-500">Start monitoring to collect water level data and view historical trends.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
