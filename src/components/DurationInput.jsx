import React, { useEffect, useState } from "react";
import { DURATION_PRESETS } from "../lib/constants.js";
import { clampMinutes, formatMinutesLabel } from "../lib/utils.js";

export default function DurationInput({ minutes, onChangeMinutes, inputId = "duration" }) {
  const [value, setValue] = useState(String(minutes || 15));

  useEffect(() => {
    setValue(String(minutes || 15));
  }, [minutes]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          id={inputId}
          type="number"
          min={1}
          className="w-28 rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            onChangeMinutes(clampMinutes(value, minutes || 1));
          }}
        />
        <span className="text-sm text-slate-600">minutos</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map((preset) => {
          const selected = minutes === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChangeMinutes(preset)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "border border-slate-300 bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {formatMinutesLabel(preset)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
