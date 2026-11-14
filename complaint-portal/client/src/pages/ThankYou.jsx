import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../lib/lang.js";
import { t } from "../i18n/index.js";

export default function ThankYou() {
  const [lang] = useLang();
  const navigate = useNavigate();
  const ref_id = sessionStorage.getItem("ref_id") || "";
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(ref_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <main className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">{t(lang,"thanks")}</h1>
      <p className="text-apthex-muted mb-6">Your complaint has been submitted successfully.</p>
      <div className="bg-gray-900 rounded-2xl p-6 mb-6">
        <div className="text-sm text-gray-400 mb-2">{t(lang,"refId")}</div>
        <div className="text-2xl font-mono font-bold text-apthex-red break-all">{ref_id}</div>
        <button onClick={copy} className="mt-4 px-4 py-2 bg-gray-800 rounded">{copied ? "Copied" : t(lang,"copy")}</button>
      </div>
      <p className="text-sm text-gray-400 mb-6">You can check the status of your complaint using this reference ID. Keep it safe.</p>
      <button onClick={() => navigate("/status")} className="px-4 py-2 bg-apthex-red rounded">{t(lang,"statusCheck")}</button>
    </main>
  );
}
