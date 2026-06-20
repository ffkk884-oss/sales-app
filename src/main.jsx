import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SalesApp from "./SalesApp.jsx";
import LoginPage from "./LoginPage.jsx";
import { supabase } from "./supabaseClient.js";

function Root() {
  const [session, setSession] = useState(undefined); // undefined = 確認中

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f4f3ee]">
        <span className="text-sm text-[#5a6a64]">読み込み中...</span>
      </div>
    );
  }

  return session ? <SalesApp /> : <LoginPage />;
}

createRoot(document.getElementById("root")).render(<Root />);