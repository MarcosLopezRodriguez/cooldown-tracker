import { useCallback, useState } from "react";

import { uid } from "../lib/sites";

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg) => {
    const id = uid();
    setToasts((current) => [...current, { id, msg }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return { push, toasts };
}

export { useToasts };
