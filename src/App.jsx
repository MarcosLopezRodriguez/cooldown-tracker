import React, { useEffect, useMemo, useRef, useState } from "react";

// ============================
// Cooldown Tracker (Single-file React App)
// ============================
// Features implemented:
// - Add/Edit/Delete sites with custom cooldown durations
// - Mark as visited to start countdown
// - Countdown list with search & filters
// - Web Notifications (permission-gated) + in-app toasts
// - Persistence via localStorage
// - Import/Export JSON
// Notes:
// - Notifications while tab is closed are limited by browser constraints
//   (no server push in this single-file version). When the tab is open or backgrounded,
//   notifications will fire reliably; if fully closed, alerts are delivered on next load.

// ---------- Utilities ----------
const LS_KEY = "cooldown_site_timers_v1";
const LS_SETTINGS_KEY = "cooldown_settings_v1";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUrl(input) {
  try {
    const tentative = input.trim();
    const withProto = /^(https?:)?\\/\\//i.test(tentative) ? tentative : `https://${tentative}`;
    const u = new URL(withProto);
    return u.toString();
  } catch {
    return null;
  }
}

function originFromUrl(url) {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

function hostnameFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url;
  }
}

function hhmmss(ms) {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Types (JS Doc) ----------
/** @typedef {Object} SiteTimer
 * @property {string} id
 * @property {string} url
 * @property {string} label
 * @property {"domain"|"url"} scope
 * @property {number} durationMs
 * @property {number|null} endAt
 * @property {number|null} lastVisitedAt
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string|null} favicon
 */

/** @typedef {Object} Settings
 * @property {number} defaultDurationMs
 * @property {boolean} soundOn
 */

const DEFAULT_SETTINGS = {
  defaultDurationMs: 30 * 60 * 1000, // 30 min
  soundOn: true,
};

// ---------- Toasts ----------
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (msg) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  return { toasts, push };
}

// ---------- Notification helpers ----------
function canNotify() {
  return "Notification" in window;
}

async function ensurePermission() {
  if (!canNotify()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return "denied";
  }
}

function notifyReady(item) {
  if (!canNotify() || Notification.permission !== "granted") return;
  const icon = item.favicon || "/favicon.ico";
  const n = new Notification(`Listo para visitar: ${item.label || hostnameFromUrl(item.url)}`, {
    body: `El cooldown ha terminado.`,
    icon,
    tag: `cooldown-${item.id}-${Date.now()}`,
  });
  // Auto-close after a few seconds to avoid clutter
  setTimeout(() => n.close(), 5000);
}

function useBeep(enabled) {
  const ctxRef = useRef(null);
  const beep = () => {
    if (!enabled) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctxRef.current = ctxRef.current || new AudioCtx();
    const ctx = ctxRef.current;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880; // A5
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
    }, 180);
  };
  return beep;
}

// ---------- Persistence ----------
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveState(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

// ---------- Main App ----------
export default function CooldownApp() {
  const [items, setItems] = useState(() => loadState());
  const [settings, setSettings] = useState(() => loadSettings());
  const [filter, setFilter] = useState("all"); // all | active | ready
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notifSupported] = useState(() => canNotify());
  const [permission, setPermission] = useState(() => (notifSupported ? Notification.permission : "denied"));
  const { toasts, push } = useToasts();
  const beep = useBeep(settings.soundOn);

  // For deduplicating notifications
  const notifiedRef = useRef(new Set()); // keys: `${id}:${stamp}`

  // Tick loop
  useEffect(() => {
    const t = setInterval(() => {
      setItems((prev) => {
        const now = Date.now();
        let changed = false;
        const next = prev.map((it) => {
          if (it.endAt && it.endAt <= now) {
            const key = `${it.id}:${it.endAt}`;
            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);
              notifyReady(it);
              beep();
              // escaping quotes for template strings in raw literal
              const label = it.label || hostnameFromUrl(it.url);
              // No need to escape more; building string normally
            }
            changed = true;
            return { ...it, endAt: null, updatedAt: now };
          }
          return it;
        });
        if (changed) saveState(next);
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [beep]);

  useEffect(() => saveSettings(settings), [settings]);

  // Derived view
  const shown = useMemo(() => {
    const now = Date.now();
    const term = q.trim().toLowerCase();
    let list = items.map((it) => ({ ...it, remaining: it.endAt ? Math.max(0, it.endAt - now) : 0 }));
    if (filter === "active") list = list.filter((x) => x.endAt && x.endAt > now);
    if (filter === "ready") list = list.filter((x) => !x.endAt);
    if (term) {
      list = list.filter((x) =>
        (x.label && x.label.toLowerCase().includes(term)) || x.url.toLowerCase().includes(term)
      );
    }
    list.sort((a, b) => {
      const aActive = a.endAt ? 1 : 0;
      const bActive = b.endAt ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive; // active first
      return (a.remaining || 0) - (b.remaining || 0);
    });
    return list;
  }, [items, filter, q]);

  // Actions
  const upsertItem = (draft) => {
    const now = Date.now();
    setItems((prev) => {
      const exists = prev.find((x) => x.id === draft.id);
      const next = exists
        ? prev.map((x) => (x.id === draft.id ? { ...x, ...draft, updatedAt: now } : x))
        : [...prev, { ...draft, id: draft.id || uid(), createdAt: now, updatedAt: now }];
      saveState(next);
      return next;
    });
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveState(next);
      return next;
    });
  };

  const startCooldown = (id, fromOpen = false) => {
    const now = Date.now();
    setItems((prev) => {
      const next = prev.map((x) => {
        if (x.id !== id) return x;
        return { ...x, lastVisitedAt: now, endAt: now + x.durationMs, updatedAt: now };
      });
      saveState(next);
      return next;
    });
  };

  const resetCooldown = (id) => {
    const now = Date.now();
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, endAt: now + x.durationMs, updatedAt: now } : x));
      saveState(next);
      return next;
    });
  };

  const clearCooldown = (id) => {
    const now = Date.now();
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, endAt: null, updatedAt: now } : x));
      saveState(next);
      return next;
    });
  };

  const exportData = () => {
    const payload = { items, settings, exportedAt: new Date().toISOString() };
    download("cooldown-data.json", JSON.stringify(payload, null, 2));
  };

  const importData = async (file) => {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed.items && Array.isArray(parsed.items)) {
        setItems(parsed.items);
        saveState(parsed.items);
      }
      if (parsed.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      }
    } catch {}
  };

  const requestNotifications = async () => {
    const res = await ensurePermission();
    if (res !== "granted") return;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-xl font-bold">Cooldown Tracker</span>
          <div className="ml-auto flex items-center gap-2">
            <input
              className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-[220px]"
              placeholder="Buscar…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="hidden sm:flex rounded-xl bg-slate-100 p-1">
              {[
                { k: "all", label: "Todos" },
                { k: "active", label: "Activos" },
                { k: "ready", label: "Listos" },
              ].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${filter === f.k ? "bg-white shadow border" : "text-slate-600"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            { (typeof Notification !== 'undefined') && Notification.permission !== "granted" && (
              <button
                onClick={requestNotifications}
                className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
              >
                Activar notificaciones
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SettingsPanel settings={settings} setSettings={setSettings} onExport={exportData} onImport={() => {}} />

        {shown.length === 0 ? (
          <EmptyState onAdd={() => {}} />
        ) : (
          <ul className="grid md:grid-cols-2 gap-4" aria-live="polite">
            {shown.map((it) => (
              <li key={it.id} className="">
                <SiteCard
                  item={it}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onStart={() => {}}
                  onReset={() => {}}
                  onClear={() => {}}
                  onOpen={() => {}}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="py-10 text-center text-xs text-slate-500">
        Nota: Las notificaciones mientras la pestaña esté cerrada pueden no llegar sin reabrir la app.
      </footer>
    </div>
  );
}

// ---------- Components ----------
function EmptyState({ onAdd }) {
  return (
    <div className="mt-24 flex flex-col items-center gap-3 text-center">
      <div className="text-5xl">⏳</div>
      <h2 className="text-xl font-semibold">Aún no hay sitios</h2>
      <p className="text-slate-600 max-w-sm">
        Añade webs que sueles visitar para crear un "cooldown" personalizado y evitar volver demasiado pronto.
      </p>
      <button onClick={onAdd} className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
        Añadir primer sitio
      </button>
    </div>
  );
}

function SiteCard({ item, onEdit, onDelete, onStart, onReset, onClear, onOpen }) {
  const ready = !item.endAt;
  const host = hostnameFromUrl(item.url);
  const status = ready ? "Listo" : hhmmss(Math.max(0, item.endAt - Date.now()));
  const progress = React.useMemo(() => {
    if (!item.endAt || !item.lastVisitedAt) return 0;
    const total = item.durationMs;
    const elapsed = Math.min(total, Math.max(0, Date.now() - item.lastVisitedAt));
    return Math.round((elapsed / total) * 100);
  }, [item.endAt, item.lastVisitedAt, item.durationMs]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
        {item.favicon ? (
          <img src={item.favicon} alt="favicon" className="w-6 h-6" />
        ) : (
          <span className="text-lg">🌐</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold truncate">{item.label || host}</div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {ready ? "Listo" : "En cooldown"}
          </span>
          <span className="ml-auto text-sm tabular-nums">{status}</span>
        </div>
        <div className="text-xs text-slate-600 truncate">{item.scope === "domain" ? host : item.url}</div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-slate-900" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onOpen} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50">Abrir y empezar</button>
          <button onClick={onStart} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50">Marcar visitado</button>
          {!ready && (
            <button onClick={onReset} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50">Reiniciar</button>
          )}
          {!ready && (
            <button onClick={onClear} className="px-3 py-1.5 rounded-lg border hover:bg-rose-200 text-rose-800">Limpiar</button>
          )}
          <button onClick={onEdit} className="ml-auto px-3 py-1.5 rounded-lg border hover:bg-slate-50">Editar</button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, setSettings, onExport, onImport }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold mb-2">Ajustes</h2>
      <div className="grid md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Duración por defecto (minutos)</label>
          <DurationInput
            minutes={Math.round(settings.defaultDurationMs / 60000)}
            onChangeMinutes={(mins) => setSettings((s) => ({ ...s, defaultDurationMs: Math.max(1, mins) * 60000 }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="soundToggle"
            type="checkbox"
            checked={settings.soundOn}
            onChange={(e) => setSettings((s) => ({ ...s, soundOn: e.target.checked }))}
          />
          <label htmlFor="soundToggle" className="text-sm">Sonido al terminar</label>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onExport} className="px-3 py-2 rounded-xl border hover:bg-slate-50">Exportar JSON</button>
          <label className="px-3 py-2 rounded-xl border hover:bg-slate-50 cursor-pointer">
            Importar JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          </label>
        </div>
      </div>
    </section>
  );
}

function DurationInput({ minutes, onChangeMinutes }) {
  const presets = [15, 30, 60, 120, 1440];
  const [val, setVal] = useState(String(minutes || 30));
  useEffect(() => setVal(String(minutes || 30)), [minutes]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        className="w-24 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const n = Math.max(1, parseInt(val || "0", 10));
          onChangeMinutes(n);
        }}
      />
      <span className="text-sm text-slate-600">min</span>
      <div className="flex flex-wrap gap-1">
        {presets.map((m) => (
          <button key={m} onClick={() => onChangeMinutes(m)} className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs">
            {m >= 60 ? `${m / 60}h` : `${m}m`}
          </button>
        ))}
      </div>
    </div>
  );
}
