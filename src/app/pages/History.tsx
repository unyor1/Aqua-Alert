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
    // clone range so React state updates even if the reference didn't change
    setAppliedRange(
      range
        ? {
            from: range.from ? new Date(range.from) : undefined,
            to: range.to ? new Date(range.to) : undefined,
          }
        : undefined,
    );
    setPopoverOpen(false);
    // short animation, then stop
    setTimeout(() => setApplyAnimating(false), 600);
  };

  const [applyAnimating, setApplyAnimating] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadReadings = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/login");
        return;
      }

        // don't set welcome here; Dashboard will show the welcome message by name

      // build query: select -> apply date filters -> order -> limit
      let query: any = supabase.from("sensor_logs").select("created_at, water_level");

      if (appliedRange && appliedRange.from) {
        const start = new Date(appliedRange.from);
        start.setHours(0, 0, 0, 0);
        query = query.gte("created_at", start.toISOString());
        // if user selected only a single day (no `to`), apply upper bound for that same day
        if (!appliedRange.to) {
          const singleEnd = new Date(appliedRange.from);
          singleEnd.setHours(23, 59, 59, 999);
          query = query.lte("created_at", singleEnd.toISOString());
        }
      }
      if (appliedRange && appliedRange.to) {
        const end = new Date(appliedRange.to);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      // If the user applied a date filter, fetch more rows to avoid dropping older days
      if (appliedRange) {
        query = query.order("created_at", { ascending: false }).limit(1000);
      } else {
        query = query.order("created_at", { ascending: false }).limit(100);
      }

      const { data: logs, error } = await query;
      if (error) {
        console.error("Failed to load readings:", error);
        return;
      }

      if (!logs) {
        if (isMounted) setReadings([]);
        return;
      }

      const parsedReadings = logs.map((log: any) => {
        const raw = Number(log.water_level) || 0;
        const reversed = Math.max(0, Math.min(100, 100 - raw));
        return {
          timestamp: new Date(log.created_at),
          level: reversed,
        };
      });

      // ensure chronological order for charts (oldest -> newest)
      const sortedReadings = parsedReadings.sort((a: WaterReading, b: WaterReading) => a.timestamp.getTime() - b.timestamp.getTime());
      if (isMounted) setReadings(sortedReadings);
    };

    void loadReadings();

    return () => {
      isMounted = false;
    };
  }, [navigate, appliedRange]);

  // Prepare chart data
  const multiDayRange = !!(appliedRange && appliedRange.from && appliedRange.to && !isSameDay(appliedRange.from, appliedRange.to));

  const chartData = readings.map((reading) => ({
    timestampMs: reading.timestamp.getTime(),
    level: reading.level,
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
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
                        setAppliedRange(undefined);
                        setPopoverOpen(false);
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
                    <XAxis
                      dataKey="timestampMs"
                      type="number"
                      tick={{ fontSize: 12 }}
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(val: number) =>
                        multiDayRange
                          ? new Date(val).toLocaleDateString()
                          : new Date(val).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                      }
                    />
                    <YAxis label={{ value: "Water Level (cm)", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const ts = payload[0].payload.timestampMs;
                          const d = new Date(ts);
                          const dateStr = d.toLocaleDateString();
                          const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                          return (
                            <div className="bg-white p-3 border rounded-lg shadow-lg">
                              <p className="text-sm font-medium">{dateStr}</p>
                              <p className="text-sm">{timeStr}</p>
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
