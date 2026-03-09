import { useCallback, useRef, useState } from "react";

import { hostnameFromUrl, normalizeSettings } from "../lib/sites";

function canNotify() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function ensurePermission() {
  if (!canNotify()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function useNotificationCenter({ notificationsOn, soundOn, setSettings, push }) {
  const audioContextRef = useRef(null);
  const [notifSupported] = useState(() => canNotify());
  const [permission, setPermission] = useState(() => (
    notifSupported ? Notification.permission : "denied"
  ));

  const beep = useCallback(() => {
    if (!soundOn) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    audioContextRef.current = audioContextRef.current || new AudioCtx();
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 180);
  }, [soundOn]);

  const notifyReady = useCallback((item) => {
    if (!notifSupported || permission !== "granted" || !notificationsOn) return;
    const icon = item.favicon || "/favicon.ico";
    const notification = new Notification(
      `Listo para visitar: ${item.label || hostnameFromUrl(item.url)}`,
      {
        body: "El cooldown ha terminado.",
        icon,
        tag: `cooldown-${item.id}-${Date.now()}`,
      },
    );
    setTimeout(() => notification.close(), 5000);
  }, [notifSupported, notificationsOn, permission]);

  const notifyItemReady = useCallback((item) => {
    notifyReady(item);
    beep();
    push(`"${item.label || hostnameFromUrl(item.url)}" ya se puede visitar.`);
  }, [beep, notifyReady, push]);

  const requestNotifications = useCallback(async () => {
    const result = await ensurePermission();
    setPermission(result);
    const enabled = result === "granted";
    setSettings((prev) => normalizeSettings({ ...prev, notificationsOn: enabled }));
    push(enabled ? "Notificaciones activadas" : "Permiso denegado");
    return enabled;
  }, [push, setSettings]);

  const toggleNotifications = useCallback(async () => {
    if (notificationsOn) {
      setSettings((prev) => normalizeSettings({ ...prev, notificationsOn: false }));
      push("Notificaciones desactivadas");
      return false;
    }

    if (!notifSupported) {
      push("Este navegador no soporta notificaciones.");
      return false;
    }

    return requestNotifications();
  }, [notifSupported, notificationsOn, push, requestNotifications, setSettings]);

  return {
    notifSupported,
    notifyItemReady,
    permission,
    toggleNotifications,
  };
}

export { useNotificationCenter };
