export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface border border-border shadow-card rounded-2xl p-8 text-center border border-border">
        <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">📡</span>
        </div>
        <h1 className="text-2xl font-bold text-fg mb-2">Нет соединения</h1>
        <p className="text-fg-muted">Проверьте подключение к интернету</p>
      </div>
    </div>
  );
}