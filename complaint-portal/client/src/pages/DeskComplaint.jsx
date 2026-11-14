import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";

export default function DeskComplaint() {
  const { ref } = useParams();
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const d = await api(`/api/complaints/${ref}`);
    setData(d);
  }
  useEffect(() => { load(); }, [ref]);

  async function update(patch) {
    await api(`/api/complaints/${ref}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  }

  async function addNote() {
    await api(`/api/complaints/${ref}`, { method: "PATCH", body: JSON.stringify({ note }) });
    setNote("");
    await load();
  }

  if (!data) return <main className="p-6">Loading...</main>;
  const c = data.complaint;
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{c.ref_id}</h1>
      <section className="bg-gray-900 rounded p-4 space-y-2">
        <div><b>Institute:</b> {c.institute_code}</div>
        <div><b>Category:</b> {c.category}</div>
        <div><b>Urgent:</b> {c.urgent ? "YES" : "No"}</div>
        <div><b>Status:</b> {c.status}</div>
        <div><b>Mode:</b> {c.mode}</div>
        <div><b>Created:</b> {new Date(c.created_at).toLocaleString()}</div>
        {c.class_label && <div><b>Class:</b> {c.class_label}</div>}
        <div className="mt-3"><b>Description:</b><p className="whitespace-pre-wrap">{c.details_text}</p></div>
      </section>

      {data.contacts && data.contacts.length > 0 && (
        <section className="bg-gray-900 rounded p-4">
          <h2 className="font-semibold mb-2">Contacts</h2>
          {data.contacts.map((ct) => (
            <div key={ct._id} className="text-sm border-b border-gray-800 py-2">
              <div>{ct.name} {ct.roll_no && `(${ct.roll_no})`}</div>
              <div>{ct.mobile} {ct.email}</div>
              {ct.kind === "followup" && <div className="text-gray-400">follow-up</div>}
            </div>
          ))}
        </section>
      )}

      {data.attachments && data.attachments.length > 0 && (
        <section className="bg-gray-900 rounded p-4">
          <h2 className="font-semibold mb-2">Evidence</h2>
          <ul className="space-y-1">
            {data.attachments.map((a) => (
              <li key={a._id} className="text-sm">
                <a href={`/api/attachments/${a._id}/download`} target="_blank" rel="noreferrer" className="text-blue-400 underline">{a.type} - {a.mime} ({a.size_bytes} bytes)</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-gray-900 rounded p-4 space-y-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={c.status === "completed"} onChange={(e) => update({ completed: e.target.checked })} />
          Completed
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!c.flagged_spam} onChange={(e) => update({ flagged_spam: e.target.checked })} />
          Flag as spam
        </label>
        <div className="flex gap-2">
          <input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Internal note" className="flex-1 bg-black border border-gray-700 rounded px-3 py-2" />
          <button onClick={addNote} className="px-3 py-2 bg-gray-800 rounded">Add note</button>
        </div>
        {msg && <p className="text-green-400 text-sm">{msg}</p>}
      </section>
    </main>
  );
}
