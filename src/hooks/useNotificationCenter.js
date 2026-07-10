import { useCallback, useRef, useState } from "react";
import { hostnameFromUrl } from "../lib/utils.js";

function canNotify() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function ensurePermission() {
  if (!canNotify()) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function showBrowserNotification(item) {
  if (!canNotify() || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(`Listo para visitar: ${item.label || hostnameFromUrl(item.url)}`, {
    body: "El cooldown ha terminado.",
    tag: `cooldown-${item.id}-${Date.now()}`,
  });

  window.setTimeout(() => {
    notification.close();
  }, 5000);
}

export function useNotificationCenter({ notificationsOn, soundOn, push }) {
  const supported = canNotify();
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : "denied"));
  const audioContextRef = useRef(null);

  const primeAudio = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    audioContextRef.current = audioContextRef.current || new AudioContextCtor();
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  const playBeep = useCallback(() => {
    if (!soundOn || typeof window === "undefined") {
      return;
    }

    primeAudio();
    const context = audioContextRef.current;
    if (!context || context.state !== "running") {
      return;
    }
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.05;

    oscillator.connect(gainNode).connect(context.destination);
    oscillator.start();
    window.setTimeout(() => {
      oscillator.stop();
    }, 180);
  }, [primeAudio, soundOn]);

  const notifyReady = useCallback(
    (item) => {
      if (notificationsOn && permission === "granted") {
        showBrowserNotification(item);
      }
      playBeep();
    },
    [notificationsOn, permission, playBeep],
  );

  const toggleNotifications = useCallback(async () => {
    if (!supported) {
      push("Este navegador no soporta notificaciones.", "error");
      return false;
    }

    if (notificationsOn) {
      push("Notificaciones desactivadas.", "success");
      return false;
    }

    const nextPermission = await ensurePermission();
    setPermission(nextPermission);

    if (nextPermission === "granted") {
      push("Notificaciones activadas.", "success");
      return true;
    }

    push("Permiso de notificaciones denegado.", "error");
    return false;
  }, [notificationsOn, push, supported]);

  return {
    supported,
    permission,
    toggleNotifications,
    notifyReady,
    primeAudio,
  };
}
