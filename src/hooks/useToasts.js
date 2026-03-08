import { useCallback, useState } from "react";
import { uid } from "../lib/utils.js";

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = "info") => {
    const id = uid();
    setToasts((currentToasts) => [...currentToasts, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return { toasts, push };
}
