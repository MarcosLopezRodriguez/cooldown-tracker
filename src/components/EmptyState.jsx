function EmptyState({ onAdd }) {
  return (
    <div className="mt-24 flex flex-col items-center gap-3 text-center">
      <div className="text-5xl">...</div>
      <h2 className="text-xl font-semibold">Aun no hay sitios</h2>
      <p className="text-slate-600 max-w-sm">
        Anade webs que sueles visitar para crear un "cooldown" personalizado y evitar volver demasiado pronto.
      </p>
      <button onClick={onAdd} className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
        Anadir primer sitio
      </button>
    </div>
  );
}

export { EmptyState };
