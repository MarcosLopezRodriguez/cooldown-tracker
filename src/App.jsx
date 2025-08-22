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
    const withProto = /^(https?:)?\/\//i.test(tentative) ? tentative : `https://${tentative}`;
    const u = new URL(withProto);
    return u.toString();
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
  const [items, setItems] = useState(loadState);
  const [settings, setSettings] = useState(loadSettings);
  const [filter, setFilter] = useState("all"); // all | active | ready
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
              push(`\"${it.label || hostnameFromUrl(it.url)}\" ya se puede visitar.`);
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
  }, [push, beep]);

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
    if (!fromOpen) push("Cooldown iniciado");
  };

  const resetCooldown = (id) => {
    const now = Date.now();
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, endAt: now + x.durationMs, updatedAt: now } : x));
      saveState(next);
      return next;
    });
    push("Reiniciado");
  };

  const clearCooldown = (id) => {
    const now = Date.now();
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, endAt: null, updatedAt: now } : x));
      saveState(next);
      return next;
    });
    push("Limpio");
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
      push("Datos importados");
    } catch {
      push("Archivo inválido");
    }
  };

  const requestNotifications = async () => {
    const res = await ensurePermission();
    setPermission(res);
    if (res === "granted") push("Notificaciones activadas");
    else push("Permiso denegado");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 relative">
      {/* Settings Panel Overlay */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 ease-in-out"
          onClick={() => setShowSettings(false)}
        />
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-white/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                C
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Cooldown Tracker
              </h1>
            </div>

            {/* Search and Actions */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-white/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-slate-700 placeholder-slate-400"
                  placeholder="Buscar sitios..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              {/* Filter Buttons */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { value: "all", label: "Todos" },
                  { value: "active", label: "En cooldown" },
                  { value: "ready", label: "Listos" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      filter === tab.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(prev => !prev)}
                  className={`p-2.5 rounded-xl border transition-all duration-300 ${
                    showSettings 
                      ? 'bg-blue-50 border-blue-200 text-blue-600' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                  }`}
                  title={showSettings ? 'Cerrar configuración' : 'Configuración'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor" style={{
                    transform: showSettings ? 'rotate(30deg)' : 'rotate(0)'
                  }}>
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  <span className="hidden sm:inline">Nuevo sitio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        <div className="w-full">
          {/* Settings Panel - Floating */}
          <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
            showSettings ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="h-full overflow-y-auto p-6">
              <button
                onClick={() => setShowSettings(false)}
                className="fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors duration-200"
                aria-label="Cerrar configuración"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
                onExport={exportData}
                onImport={importData}
                onClose={() => setShowSettings(false)}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="w-full">

            {shown.length === 0 ? (
              <EmptyState onAdd={() => setShowForm(true)} />
            ) : (
              <ul className="grid md:grid-cols-2 gap-4" aria-live="polite">
                {shown.map((it) => (
                  <li key={it.id} className="">
                    <SiteCard
                      item={it}
                      onEdit={() => {
                        setEditing(it);
                        setShowForm(true);
                      }}
                      onDelete={() => {
                        if (confirm("¿Eliminar este sitio?")) removeItem(it.id);
                      }}
                      onStart={() => startCooldown(it.id)}
                      onReset={() => resetCooldown(it.id)}
                      onClear={() => clearCooldown(it.id)}
                      onOpen={() => {
                        try {
                          // Ensure URL has a protocol
                          let urlToOpen = it.url.trim();
                          if (!/^https?:\/\//i.test(urlToOpen)) {
                            urlToOpen = 'https://' + urlToOpen;
                          }
                          
                          // Use chrome.tabs.create if available (Chrome extension context)
                          if (chrome && chrome.tabs) {
                            chrome.tabs.create({ url: urlToOpen, active: true }, () => {
                              if (chrome.runtime.lastError) {
                                throw new Error(chrome.runtime.lastError.message);
                              }
                              startCooldown(it.id, true);
                            });
                          } 
                          // Fallback to window.open for development
                          else {
                            const newWindow = window.open(urlToOpen, '_blank');
                            if (!newWindow) {
                              throw new Error('No se pudo abrir la página. Por favor, verifica que los popups estén habilitados para este sitio.');
                            }
                            startCooldown(it.id, true);
                          }
                        } catch (error) {
                          console.error('Error opening URL:', error);
                          alert(`Error al abrir la URL: ${error.message || 'URL inválida o bloqueada'}`);
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {showForm && (
        <AddEditModal
          initial={editing}
          defaultDurationMs={settings.defaultDurationMs}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={(payload, options) => {
            const existing = editing;
            if (existing && existing.endAt && payload.durationMs !== existing.durationMs) {
              const applyNow = confirm(
                "Has cambiado la duración. Aceptar = aplicar ahora. Cancelar = aplicar en la próxima visita."
              );
              if (applyNow) {
                payload.endAt = existing.lastVisitedAt ? existing.lastVisitedAt + payload.durationMs : null;
              }
            }
            upsertItem(payload);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 space-y-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className="px-4 py-2 bg-slate-900 text-white rounded-xl shadow">
            {t.msg}
          </div>
        ))}
      </div>

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
        Añade webs que sueles visitar para crear un \"cooldown\" personalizado y evitar volver demasiado pronto.
      </p>
      <button onClick={onAdd} className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
        Añadir primer sitio
      </button>
    </div>
  );
}

function SiteCard({ item, onEdit, onDelete, onStart, onReset, onClear, onOpen }) {
  const [now, setNow] = useState(Date.now());
  
  // Update current time every second for the countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const ready = !item.endAt || item.endAt <= now;
  const host = hostnameFromUrl(item.url);
  const status = ready ? "Listo" : hhmmss(Math.max(0, item.endAt - now));
  
  const progress = useMemo(() => {
    if (!item.endAt || !item.lastVisitedAt) return 0;
    const total = item.durationMs;
    const elapsed = Math.min(total, Math.max(0, now - item.lastVisitedAt));
    return Math.round((elapsed / total) * 100);
  }, [item.endAt, item.lastVisitedAt, item.durationMs, now]);

  return (
    <div className="group relative rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Status indicator */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
      
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Favicon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
            {item.favicon ? (
              <img 
                src={item.favicon} 
                alt="" 
                className="w-6 h-6" 
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span class="text-xl text-slate-400">🌐</span>';
                }}
              />
            ) : (
              <span className="text-xl text-slate-400">🌐</span>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-semibold text-slate-900 truncate">{item.label || host}</h3>
              <span className={`ml-2 text-xs px-2 py-1 rounded-full font-medium ${
                ready 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {ready ? 'Listo' : 'En cooldown'}
              </span>
              <span className="ml-auto text-sm font-mono tabular-nums text-slate-500">
                {status}
              </span>
            </div>
            
            <p className="mt-1 text-sm text-slate-500 truncate">
              {item.scope === "domain" ? host : item.url}
            </p>
            
            {/* Progress bar */}
            {!ready && (
              <div className="mt-3 space-y-1">
                <div className="text-xs text-slate-500 flex justify-between">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      progress > 80 ? 'bg-emerald-500' : 'bg-blue-500'
                    } transition-all duration-300`} 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          <button 
            onClick={onOpen}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Abrir
          </button>
          
          <button 
            onClick={onStart}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Marcar visitado
          </button>
          
          {!ready && (
            <button 
              onClick={onReset}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Reiniciar
            </button>
          )}
          
          <div className="ml-auto flex items-center gap-1">
            <button 
              onClick={onEdit}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Editar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            
            <button 
              onClick={onDelete}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
              title="Eliminar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, setSettings, onExport, onImport, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  const [file, setFile] = useState(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setFile(file);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        onImport(data);
        setShowImportSuccess(true);
        setTimeout(() => setShowImportSuccess(false), 3000);
      } catch (err) {
        console.error('Error al importar datos:', err);
        alert('Error al importar datos. El archivo no es válido.');
      }
    };
    
    reader.onerror = () => {
      alert('Error al leer el archivo. Por favor, inténtalo de nuevo.');
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg transform transition-all duration-300 hover:shadow-xl">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 text-slate-400" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" 
              clipRule="evenodd" 
            />
          </svg>
          Configuración
        </h2>
      </div>
      
      <div className="divide-y divide-slate-100">
        {/* Notification Settings */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Notificaciones</h3>
              <p className="text-sm text-slate-500">Recibir notificaciones cuando un temporizador termine</p>
            </div>
            <button
              type="button"
              className={`${
                settings.notifications ? 'bg-blue-600' : 'bg-slate-200'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              onClick={() => setSettings({ ...settings, notifications: !settings.notifications })}
            >
              <span className="sr-only">Activar notificaciones</span>
              <span
                className={`${
                  settings.notifications ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>

        {/* Sound Settings */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Sonido</h3>
              <p className="text-sm text-slate-500">Reproducir sonido al finalizar un temporizador</p>
            </div>
            <button
              type="button"
              className={`${
                settings.sound ? 'bg-blue-600' : 'bg-slate-200'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              onClick={() => setSettings({ ...settings, sound: !settings.sound })}
            >
              <span className="sr-only">Activar sonido</span>
              <span
                className={`${
                  settings.sound ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>

        {/* Export/Import */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Datos</h3>
          <div className="space-y-3">
            <button
              type="button"
              onClick={onExport}
              className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar datos
            </button>
            
            <div>
              <label className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importar datos
                <input type="file" className="hidden" onChange={handleImport} accept=".json" />
              </label>
              {showImportSuccess && (
                <p className="mt-2 text-sm text-green-600">¡Datos importados correctamente!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DurationInput({ minutes, onChangeMinutes }) {
  const presets = [5, 10, 15, 30, 60]; // 5m, 10m, 15m, 30m, 1h
  const [val, setVal] = useState(String(minutes || 15));
  
  useEffect(() => setVal(String(minutes || 15)), [minutes]);
  
  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = minutes / 60;
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
  };

  return (
    <div className="space-y-2">
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
        <span className="text-sm text-slate-600">minutos</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((m) => (
          <button 
            key={m} 
            onClick={() => onChangeMinutes(m)} 
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              minutes === m 
                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {formatTime(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddEditModal({ initial, onClose, onSave }) {
  const [url, setUrl] = useState(initial?.url || '');
  const [label, setLabel] = useState(initial?.label || '');
  const [minutes, setMinutes] = useState(initial ? Math.round(initial.durationMs / 60000) : 30);
  const [scope, setScope] = useState(initial?.scope || 'domain');
  const [favicon, setFavicon] = useState(initial?.favicon || null);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const host = hostnameFromUrl(url);
    if (host) {
      setFavicon(`https://www.google.com/s2/favicons?domain=${host}&sz=64`);
      if (!label && !initial?.label) {
        setLabel(host);
      }
    }
    setIsValid(!!host && minutes > 0);
  }, [url, minutes, label, initial]);

  const save = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Normalize URL
      let normalized = url.trim();
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = 'https://' + normalized;
      }
      
      // Get hostname for favicon
      const host = hostnameFromUrl(normalized);
      const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null;

      const now = Date.now();
      const durationMs = Math.max(60000, minutes * 60000);
      
      const payload = {
        id: initial?.id || uid(),
        url: normalized,
        label: label || host,
        scope,
        durationMs,
        endAt: initial?.endAt || now + durationMs,
        lastVisitedAt: initial?.lastVisitedAt || now,
        favicon,
        createdAt: initial?.createdAt || now,
        updatedAt: now,
      };
      
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error saving site:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 bg-white border-b border-slate-100 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {initial ? 'Editar sitio' : 'Añadir nuevo sitio'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {initial ? 'Actualiza los detalles del sitio' : 'Configura un nuevo sitio para rastrear'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Favicon Preview */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                {favicon ? (
                  <img 
                    src={favicon} 
                    alt="" 
                    className="w-8 h-8"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<span class="text-2xl text-slate-400">🌐</span>';
                    }}
                  />
                ) : (
                  <span className="text-2xl text-slate-300">🌐</span>
                )}
              </div>
              {url && (
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* URL Input */}
          <div className="space-y-2">
            <label htmlFor="url" className="block text-sm font-medium text-slate-700">
              URL del sitio
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 1 1 0 001.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="url"
                ref={inputRef}
                type="text"
                placeholder="https://ejemplo.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && save()}
              />
            </div>
          </div>
          
          {/* Label Input */}
          <div className="space-y-2">
            <label htmlFor="label" className="block text-sm font-medium text-slate-700">
              Nombre personalizado {label && <span className="text-slate-400 font-normal">({label.length}/30)</span>}
            </label>
            <div className="relative">
              <input
                id="label"
                type="text"
                placeholder="Mi sitio web"
                value={label}
                maxLength={30}
                onChange={e => setLabel(e.target.value)}
                className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && save()}
              />
            </div>
          </div>
          
          {/* Duration Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Tiempo de cooldown
            </label>
            <DurationInput 
              minutes={minutes} 
              onChangeMinutes={setMinutes}
            />
          </div>
          
          {/* Scope Selection */}
          <div className="space-y-2 pt-2">
            <span className="block text-sm font-medium text-slate-700">
              Ámbito de bloqueo
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope('domain')}
                className={`p-3 text-left rounded-xl border-2 transition-all ${
                  scope === 'domain' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    scope === 'domain' 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-slate-300 bg-white'
                  }`}>
                    {scope === 'domain' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-slate-800">Dominio completo</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 text-left pl-7">
                  Bloquear todo el dominio (ej: ejemplo.com/*)
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => setScope('exact')}
                className={`p-3 text-left rounded-xl border-2 transition-all ${
                  scope === 'exact'
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    scope === 'exact' 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-slate-300 bg-white'
                  }`}>
                    {scope === 'exact' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-slate-800">URL exacta</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 text-left pl-7">
                  Solo bloquear la URL específica
                </p>
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 rounded-b-2xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!isValid || isSubmitting}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors ${
                !isValid || isSubmitting
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {initial ? 'Guardando...' : 'Añadiendo...'}
                </span>
              ) : initial ? (
                'Guardar cambios'
              ) : (
                'Añadir sitio'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
