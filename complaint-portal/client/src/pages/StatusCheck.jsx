import { useState } from "react";
import { api } from "../lib/api.js";

export default function StatusCheck() {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("");
  const [followup, setFollowup] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function check() {
    setErr(""); setStatus(""); setMsg("");
    try {
      const data = await api(`/api/status/${encodeURIComponent(ref)}`);
      setStatus(data.status);
    } catch (e) { setErr(e.message); }
  }
  async function submitFollowup() {
    setErr(""); setMsg("");
    try {
      await api(`/api/status/${encodeURIComponent(ref)}/followup`, { method: "POST", body: JSON.stringify({ text: followup }) });
      setMsg("Follow-up submitted.");
      setFollowup("");
    } catch (e) { setErr(e.message); }
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Check complaint status</h1>
      <div className="flex gap-2 mb-4">
        <input value={ref} onChange={(e)=>setRef(e.target.value)} placeholder="Reference ID" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
        <button onClick={check} className="px-4 py-2 bg-apthex-red rounded-lg">Check</button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {status && <p className="text-lg mb-4">Status: <span className="font-semibold text-apthex-red">{status}</span></p>}
      {status && (
        <section className="space-y-2">
          <textarea value={followup} onChange={(e)=>setFollowup(e.target.value)} placeholder="Additional details (follow-up)" rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
          <button onClick={submitFollowup} className="px-4 py-2 bg-gray-800 rounded">Submit follow-up</button>
          {msg && <p className="text-green-400 text-sm">{msg}</p>}
        </section>
      )}
    </main>
  );
}
