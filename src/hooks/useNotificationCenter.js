import { useCallback, useRef, useState } from "react";
import { buildFaviconUrl, hostnameFromUrl } from "../lib/utils.js";

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

function showBrowserNotification(item, t) {
  if (!canNotify() || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(t("notificationTitle", { name: item.label || hostnameFromUrl(item.url) }), {
    body: t("notificationBody"),
    icon: item.favicon || buildFaviconUrl(item.url),
    tag: `cooldown-${item.id}-${Date.now()}`,
  });

  window.setTimeout(() => {
    notification.close();
  }, 5000);
}

export function useNotificationCenter({ notificationsOn, soundOn, push, t }) {
  const supported = canNotify();
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : "denied"));
  const audioContextRef = useRef(null);

  const playBeep = useCallback(() => {
    if (!soundOn || typeof window === "undefined") {
      return;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    audioContextRef.current = audioContextRef.current || new AudioContextCtor();
    const context = audioContextRef.current;
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
  }, [soundOn]);

  const notifyReady = useCallback(
    (item) => {
      if (notificationsOn && permission === "granted") {
        showBrowserNotification(item, t);
      }
      playBeep();
    },
    [notificationsOn, permission, playBeep, t],
  );

  const toggleNotifications = useCallback(async () => {
    if (!supported) {
      push(t("notificationUnsupported"), "error");
      return false;
    }

    if (notificationsOn) {
      push(t("notificationsDisabled"), "success");
      return false;
    }

    const nextPermission = await ensurePermission();
    setPermission(nextPermission);

    if (nextPermission === "granted") {
      push(t("notificationsEnabled"), "success");
      return true;
    }

    push(t("notificationPermissionDenied"), "error");
    return false;
  }, [notificationsOn, push, supported, t]);

  return {
    supported,
    permission,
    toggleNotifications,
    notifyReady,
  };
}
