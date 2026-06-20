import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f3ee] p-4" style={{ fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#1c3d34] flex items-center justify-center text-white font-bold text-lg mb-3">販</div>
          <h1 className="font-semibold text-lg">販売管理</h1>
          <p className="text-xs text-[#9a9a92] mt-1">社員アカウントでログインしてください</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-[#6a6a62] mb-1">メールアドレス</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#dadad2] text-sm focus:outline-none focus:ring-2 focus:ring-[#1c3d34]/30 focus:border-[#1c3d34]"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[#6a6a62] mb-1">パスワード</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#dadad2] text-sm focus:outline-none focus:ring-2 focus:ring-[#1c3d34]/30 focus:border-[#1c3d34]"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div className="text-sm text-[#c0524a] bg-[#fbe9e7] rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-[#1c3d34] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#15302a] transition-colors disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}