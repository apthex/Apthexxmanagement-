"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrfToken } from "../lib/api.js";
import Icon from "./Icon.jsx";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function Protected({ children }) {
  const [member, setMember] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    api("/api/auth/me")
      .then((data) => {
        if (cancelled) return;
        setCsrfToken(data.csrfToken);
        setMember(data.member);
        setState("ready");
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (requestError.status === 401) {
          router.replace("/staff/login");
          return;
        }
        setError(requestError.message || "Could not verify your session.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <div className="center-state" role="status" aria-live="polite">
        <span className="spinner" />
        <p>Verifying secure session…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="center-state">
        <span className="icon-tile icon-tile-red"><Icon name="alert" size={26} /></span>
        <h1>Unable to open the Case Desk</h1>
        <p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  return <AuthContext.Provider value={{ member }}>{children}</AuthContext.Provider>;
}
