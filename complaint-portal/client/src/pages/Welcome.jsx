import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../lib/lang.js";
import { t, langs } from "../i18n/index.js";
import { api } from "../lib/api.js";

export default function Welcome() {
  const [lang, setLang] = useLang();
  const [code, setCode] = useState("");
  const [inst, setInst] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function validate() {
    setErr(""); setInst(null); setLoading(true);
    try {
      const data = await api(`/api/institutes/validate?code=${encodeURIComponent(code)}`);
      setInst(data);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function speak() {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(t(lang, "explain"));
      u.lang = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
      window.speechSynthesis.speak(u);
    }
  }

  function cont() {
    if (!inst) return;
    sessionStorage.setItem("institute_code", inst.code);
    sessionStorage.setItem("institute_name", inst.name);
    navigate("/category");
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <header className="text-center mb-8">
        <div className="text-apthex-red font-bold tracking-widest text-sm">APTHEX</div>
        <h1 className="text-2xl font-semibold mt-2">{t(lang, "welcome")}</h1>
        <p className="text-apthex-muted mt-3">{t(lang, "explain")}</p>
      </header>

      <div className="flex gap-2 justify-center mb-6">
        {langs.map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`px-3 py-1 rounded-full border ${lang===l?"bg-apthex-red border-apthex-red":"border-gray-700"}`}>{l.toUpperCase()}</button>
        ))}
        <button onClick={speak} className="px-3 py-1 rounded-full border border-gray-700" aria-label="Read aloud">🔊</button>
      </div>

      <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
        <label className="block text-sm">{t(lang, "instituteCode")}</label>
        <div className="flex gap-2">
          <input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2" />
          <button onClick={validate} disabled={loading} className="px-4 py-2 bg-apthex-red rounded-lg">{t(lang,"validate")}</button>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {inst && <p className="text-green-400 text-sm">Verified: {inst.name}</p>}
        <button onClick={cont} disabled={!inst} className="w-full py-3 bg-apthex-red rounded-lg disabled:opacity-40">{t(lang,"continue")}</button>
      </section>
    </main>
  );
}
