import { useNavigate } from "react-router-dom";
import { useLang } from "../lib/lang.js";
import { t } from "../i18n/index.js";

const CATS = [
  "Blackmail and Sextortion",
  "Online Harassment or Bullying",
  "Financial Fraud or Threats",
  "Fake Profiles or Account Hacking",
  "Institution-level Issue",
];

export default function Category() {
  const [lang] = useLang();
  const navigate = useNavigate();
  function pick(cat, urgent=false) {
    sessionStorage.setItem("category", cat);
    sessionStorage.setItem("urgent", urgent ? "1" : "0");
    navigate("/details");
  }
  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">{t(lang,"categoryTitle")}</h1>
      <div className="space-y-3">
        {CATS.map((c) => (
          <button key={c} onClick={() => pick(c)} className="w-full text-left p-4 bg-gray-900 rounded-xl border border-gray-800 hover:border-apthex-red">{c}</button>
        ))}
        <button onClick={() => pick("URGENT", true)} className="w-full text-left p-4 bg-red-900/40 rounded-xl border border-red-700 font-semibold">{t(lang,"urgent")}</button>
      </div>
    </main>
  );
}
