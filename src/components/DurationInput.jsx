import { useState } from "react";
import { DURATION_PRESETS } from "../lib/constants.js";
import { clampMinutes } from "../lib/utils.js";
import { useI18n } from "../i18n/context.js";

export default function DurationInput({ minutes, onChangeMinutes, inputId = "duration", label }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState({ minutes, text: String(minutes || 15) });
  const value = draft.minutes === minutes ? draft.text : String(minutes);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          id={inputId}
          aria-label={label || t("cooldownTime")}
          type="number"
          min={1}
          className="w-28 rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-xs transition focus:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-200"
          value={value}
          onChange={(event) => {
            const text = event.target.value;
            const parsed = Number(text);
            const valid = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000_000;
            setDraft({ minutes: valid ? parsed : minutes, text });
            if (valid) onChangeMinutes(parsed);
          }}
          onBlur={() => {
            const next = Math.min(1_000_000_000, clampMinutes(value, minutes || 1));
            setDraft({ minutes: next, text: String(next) });
            onChangeMinutes(next);
          }}
        />
        <span className="text-sm text-slate-600">{t("minutes")}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map((preset) => {
          const selected = minutes === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onChangeMinutes(preset)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "border border-slate-300 bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {preset < 60 ? `${preset}m` : t(preset === 60 ? "hour" : "hours", { count: preset / 60 })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
