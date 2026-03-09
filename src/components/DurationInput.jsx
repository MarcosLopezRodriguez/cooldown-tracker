import { useEffect, useState } from "react";

function DurationInput({ minutes, onChangeMinutes }) {
  const presets = [5, 10, 15, 30, 60];
  const [value, setValue] = useState(String(minutes || 15));

  useEffect(() => {
    setValue(String(minutes || 15));
  }, [minutes]);

  const formatTime = (minutesValue) => {
    if (minutesValue < 60) return `${minutesValue}m`;
    const hours = minutesValue / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          className="w-24 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            const next = Math.max(1, parseInt(value || "0", 10));
            onChangeMinutes(next);
          }}
        />
        <span className="text-sm text-slate-600">minutos</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onChangeMinutes(preset)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              minutes === preset
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            {formatTime(preset)}
          </button>
        ))}
      </div>
    </div>
  );
}

export { DurationInput };
