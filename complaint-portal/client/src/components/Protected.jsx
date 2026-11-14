import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function Protected({ children }) {
  const [state, setState] = useState("loading");
  useEffect(() => {
    api("/api/auth/me").then(() => setState("ok")).catch(() => setState("no"));
  }, []);
  if (state === "loading") return <div className="p-6">Loading...</div>;
  if (state === "no") return <Navigate to="/staff/login" replace />;
  return children;
}
