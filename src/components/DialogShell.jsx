import React, { useEffect, useMemo, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableNodes(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (node) => node instanceof HTMLElement && !node.hasAttribute("aria-hidden"),
  );
}

export default function DialogShell({
  children,
  onClose,
  titleId,
  descriptionId,
  variant = "modal",
  initialFocusRef,
  closeOnBackdrop = true,
  panelClassName = "",
}) {
  const panelRef = useRef(null);
  const overlayClassName = useMemo(() => {
    return variant === "side"
      ? "fixed inset-0 z-40 flex justify-end bg-slate-950/40 p-0 backdrop-blur-sm"
      : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm";
  }, [variant]);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panelNode = panelRef.current;
    const fallbackTarget = panelNode;
    const focusTarget =
      initialFocusRef?.current || getFocusableNodes(panelNode)[0] || fallbackTarget;

    focusTarget?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusableNodes = getFocusableNodes(panelRef.current);
      if (!focusableNodes.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstNode = focusableNodes[0];
      const lastNode = focusableNodes[focusableNodes.length - 1];

      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [initialFocusRef, onClose]);

  const basePanelClassName =
    variant === "side"
      ? "flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      : "w-full max-w-xl rounded-3xl bg-white shadow-2xl";

  return (
    <div
      className={overlayClassName}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`${basePanelClassName} ${panelClassName}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
