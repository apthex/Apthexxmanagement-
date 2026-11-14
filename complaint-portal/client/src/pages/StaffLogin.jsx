import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function login() {
    setErr("");
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, code }) });
      if (data.needSetup) { setSetup(data); return; }
      navigate("/desk");
    } catch (e) { setErr(e.message); }
  }
  async function verifySetup() {
    setErr("");
    try {
      await api("/api/auth/verify-setup", { method: "POST", body: JSON.stringify({ email, code: verifyCode }) });
      navigate("/desk");
    } catch (e) { setErr(e.message); }
  }

  if (setup) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Set up 2FA</h1>
        <p className="text-sm text-gray-400 mb-2">Secret: {setup.secret}</p>
        <p className="text-xs text-gray-500 mb-4 break-all">{setup.otpauthUrl}</p>
        <input value={verifyCode} onChange={(e)=>setVerifyCode(e.target.value)} placeholder="6-digit code" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 mb-3" />
        <button onClick={verifySetup} className="w-full py-2 bg-apthex-red rounded">Verify & continue</button>
        {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Staff login</h1>
      <div className="space-y-3">
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
        <input value={code} onChange={(e)=>setCode(e.target.value)} placeholder="2FA code (if enabled)" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" />
        <button onClick={login} className="w-full py-2 bg-apthex-red rounded">Login</button>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </main>
  );
}
