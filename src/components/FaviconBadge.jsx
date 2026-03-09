import React, { useEffect, useState } from "react";

export default function FaviconBadge({
  src,
  label,
  sizeClassName = "h-12 w-12",
  imageClassName = "h-6 w-6",
  roundedClassName = "rounded-2xl",
}) {
  const [showFallback, setShowFallback] = useState(!src);

  useEffect(() => {
    setShowFallback(!src);
  }, [src]);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 ${sizeClassName} ${roundedClassName}`}
      aria-hidden="true"
    >
      {!showFallback && src ? (
        <img
          src={src}
          alt=""
          className={imageClassName}
          onError={() => setShowFallback(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <GlobeIcon label={label} />
        </div>
      )}
    </div>
  );
}

function GlobeIcon({ label }) {
  return (
    <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-label={label || "Sitio web"}>
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm5.2 5h-2.06a12.06 12.06 0 00-.7-2.65A6.04 6.04 0 0115.2 7zM10 3.6c.55.7 1.1 1.8 1.46 3.4H8.54C8.9 5.4 9.45 4.3 10 3.6zM7.56 4.35A12.06 12.06 0 006.86 7H4.8a6.04 6.04 0 012.76-2.65zM4.31 9h2.35c-.04.33-.06.66-.06 1s.02.67.06 1H4.31A6.85 6.85 0 014.2 10c0-.34.04-.67.11-1zm.49 4h2.06c.16.95.4 1.84.7 2.65A6.04 6.04 0 014.8 13zM10 16.4c-.55-.7-1.1-1.8-1.46-3.4h2.92c-.36 1.6-.91 2.7-1.46 3.4zm1.82-5.4H8.18a9.27 9.27 0 010-2h3.64a9.27 9.27 0 010 2zm.62 4.65c.3-.81.54-1.7.7-2.65h2.06a6.04 6.04 0 01-2.76 2.65zM13.34 11c.04-.33.06-.66.06-1s-.02-.67-.06-1h2.35c.07.33.11.66.11 1s-.04.67-.11 1h-2.35z" />
    </svg>
  );
}
