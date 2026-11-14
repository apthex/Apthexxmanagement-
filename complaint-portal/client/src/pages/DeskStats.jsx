import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function DeskStats() {
  const [codes, setCodes] = useState([]);
  const [code, setCode] = useState("");
  const [stats, setStats] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));

  useEffect(() => { api("/api/stats/institutes").then(d=>setCodes(d.codes)).catch(()=>{}); }, []);
  useEffect(() => { if (code) api(`/api/stats/institute/${code}`).then(setStats).catch(()=>{}); }, [code]);

  async function sendReport() {
    await api("/api/reports/send", { method: "POST", body: JSON.stringify({ institute_code: code, month }) });
    alert("Sent");
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Institute statistics</h1>
      <select value={code} onChange={(e)=>setCode(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2">
        <option value="">Select institute</option>
        {codes.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {stats && (
        <div className="bg-gray-900 rounded p-4 space-y-1">
          <div>Received: {stats.received}</div>
          <div>Completed: {stats.completed}</div>
          <div>In process: {stats.in_process}</div>
        </div>
      )}
      <div className="space-y-2">
        <h2 className="font-semibold">Monthly report</h2>
        <input value={month} onChange={(e)=>setMonth(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2" />
        <div className="flex gap-2">
          <a href={`/api/reports/preview?institute_code=${code}&month=${month}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-gray-800 rounded">Preview PDF</a>
          <button onClick={sendReport} className="px-3 py-2 bg-apthex-red rounded">Send report</button>
        </div>
      </div>
    </main>
  );
}
