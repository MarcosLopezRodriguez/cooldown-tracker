function ToastViewport({ toasts }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 space-y-2 z-50">
      {toasts.map((toast) => (
        <div key={toast.id} className="px-4 py-2 bg-slate-900 text-white rounded-xl shadow">
          {toast.msg}
        </div>
      ))}
    </div>
  );
}

export { ToastViewport };
