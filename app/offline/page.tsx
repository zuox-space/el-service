export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center border border-white/20">
        <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">📡</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Нет соединения</h1>
        <p className="text-gray-300">Проверьте подключение к интернету</p>
      </div>
    </div>
  );
}