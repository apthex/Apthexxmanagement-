import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../lib/lang.js";
import { t } from "../i18n/index.js";
import { api } from "../lib/api.js";

export default function Details() {
  const [lang] = useLang();
  const navigate = useNavigate();
  const urgent = sessionStorage.getItem("urgent") === "1";
  const category = sessionStorage.getItem("category");
  const institute_code = sessionStorage.getItem("institute_code");

  const [mode, setMode] = useState("identified");
  const [form, setForm] = useState({ name: "", class_label: "", roll_no: "", mobile: "", email: "", details_text: "" });
  const [files, setFiles] = useState([]);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function onFiles(e) {
    const picked = Array.from(e.target.files || []);
    const valid = picked.filter((f) => f.size <= 2 * 1024 * 1024);
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  }
  function removeFile(i) { setFiles((f) => f.filter((_, idx) => idx !== i)); }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setTimeout(() => { if (mr.state === "recording") mr.stop(); setRecording(false); }, 60000);
    } catch (e) { setErr("Microphone access denied"); }
  }
  function stopRec() {
    if (mediaRef.current && mediaRef.current.state === "recording") mediaRef.current.stop();
    setRecording(false);
  }

  async function uploadOne(ref_id, file, type) {
    const fd = new FormData();
    fd.append("ref_id", ref_id);
    fd.append("type", type);
    fd.append("file", file);
    const res = await fetch("/api/attachments", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) throw new Error("Upload failed");
  }

  async function submit() {
    setErr(""); setLoading(true); setProgress("");
    try {
      const captchaToken = "dev-token";
      const body = {
        institute_code,
        category: urgent ? "URGENT" : category,
        details_text: form.details_text,
        urgent,
        mode,
        captchaToken,
        deviceId: navigator.userAgent,
      };
      if (mode === "identified") {
        body.class_label = form.class_label;
        body.contact = { name: form.name, class_label: form.class_label, roll_no: form.roll_no, mobile: form.mobile, email: form.email };
      }
      const data = await api("/api/complaints", { method: "POST", body: JSON.stringify(body) });
      const ref_id = data.ref_id;
      // uploads
      let i = 0;
      for (const f of files) {
        setProgress(`Uploading ${++i}/${files.length}`);
        await uploadOne(ref_id, f, "image");
      }
      if (voiceBlob) {
        setProgress("Uploading voice...");
        await uploadOne(ref_id, new File([voiceBlob], "voice.webm", { type: "audio/webm" }), "voice");
      }
      sessionStorage.setItem("ref_id", ref_id);
      navigate("/thanks");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setProgress(""); }
  }

  const anon = mode === "anonymous";

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">{t(lang,"detailsTitle")}</h1>
      {urgent && <div className="bg-red-900/40 border border-red-700 rounded p-3 mb-4 text-sm">Urgent complaint mode active.</div>}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode("identified")} className={`px-3 py-1 rounded-full ${mode==="identified"?"bg-apthex-red":"border border-gray-700"}`}>Identified</button>
        <button onClick={() => setMode("anonymous")} className={`px-3 py-1 rounded-full ${mode==="anonymous"?"bg-apthex-red":"border border-gray-700"}`}>Anonymous</button>
      </div>

      <section className="space-y-3">
        {!anon && (
          <>
            <input placeholder={t(lang,"fullName")} value={form.name} onChange={(e)=>setField("name",e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
            <input placeholder={t(lang,"classLabel")} value={form.class_label} onChange={(e)=>setField("class_label",e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
            <input placeholder={t(lang,"rollNo")} value={form.roll_no} onChange={(e)=>setField("roll_no",e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
            <input placeholder={t(lang,"mobile")} value={form.mobile} onChange={(e)=>setField("mobile",e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
            <input placeholder={t(lang,"email")} value={form.email} onChange={(e)=>setField("email",e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
          </>
        )}
        <textarea placeholder={t(lang,"description")} value={form.details_text} onChange={(e)=>setField("details_text",e.target.value)} rows={5} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />

        <div>
          <label className="block text-sm mb-1">Images (max 2MB)</label>
          <input type="file" accept="image/*" multiple onChange={onFiles} />
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="text-sm flex justify-between bg-gray-800 px-2 py-1 rounded">
                <span>{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-red-400">remove</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="block text-sm mb-1">Voice recording (max 60s)</label>
          {!recording ? (
            <button onClick={startRec} className="px-3 py-2 bg-gray-800 rounded">Start recording</button>
          ) : (
            <button onClick={stopRec} className="px-3 py-2 bg-red-700 rounded">Stop</button>
          )}
          {voiceBlob && <p className="text-green-400 text-sm mt-1">Voice recorded ({(voiceBlob.size/1024).toFixed(1)} KB)</p>}
        </div>

        <div className="text-xs text-gray-500">CAPTCHA: dev mode (no key configured)</div>

        {err && <p className="text-red-400 text-sm">{err}</p>}
        {progress && <p className="text-blue-400 text-sm">{progress}</p>}

        <button onClick={submit} disabled={loading} className="w-full py-3 bg-apthex-red rounded-lg disabled:opacity-40">
          {loading ? "Submitting..." : t(lang,"submit")}
        </button>

        {mode === "identified" && (
          <button onClick={() => setMode("anonymous")} className="w-full py-2 text-sm text-gray-400 underline">{t(lang,"anonymous")}</button>
        )}
      </section>
    </main>
  );
}
