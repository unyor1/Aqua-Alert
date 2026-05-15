import { useMemo } from "react";

interface WaterLevelGaugeProps {
  level: number; // in cm
  maxLevel?: number; // in cm
}

export function WaterLevelGauge({ level, maxLevel = 100 }: WaterLevelGaugeProps) {
  // Clamp level to 0-100 (no reversal)
  const clampedLevel = Math.max(0, Math.min(100, level));
  const percentage = (clampedLevel / maxLevel) * 100;

  const status = useMemo(() => {
    // thresholds: <50 normal (green), 50-79 warning (orange), >=80 critical (red)
    if (clampedLevel < 80) return { bg: "rgba(16,185,129,0.55)", text: "Normal", textColor: "text-green-600" };
    if (clampedLevel >= 90) return { bg: "rgba(239,68,68,0.65)", text: "Critical", textColor: "text-red-600" };
    return { bg: "rgba(249,115,22,0.6)", text: "Warning", textColor: "text-orange-600" };
  }, [clampedLevel]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Water Level</span>
        <span className={`text-sm font-bold ${status.textColor}`}>{status.text}</span>
      </div>

      {/* Gauge Container */}
      <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
        {/* Markers: 0, 20, 40, 60, 80, 100 */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 px-2 pointer-events-none">
          {[100, 80, 60, 40, 20, 0].map((mark) => (
            <div key={mark} className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{mark} cm</span>
              <div className={`flex-1 border-t ${mark === 100 ? 'border-gray-300' : mark === 0 ? 'border-gray-300' : 'border-dashed border-gray-300'} mx-2`}></div>
            </div>
          ))}
        </div>

        {/* Water Level (translucent fill) */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out`}
          style={{ height: `${percentage}%`, backgroundColor: status.bg }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white" style={{ opacity: 0.18 }} />
        </div>

        {/* Current Level Indicator */}
        <div
          className="absolute left-0 right-0 flex items-center justify-center transition-all duration-1000"
          style={{ bottom: `calc(${percentage}% - 1rem)` }}
        >
          <div className="shadow-lg rounded-full px-3 py-1 border-2 border-gray-300" style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <span className="text-sm font-bold text-gray-800">{clampedLevel} cm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
