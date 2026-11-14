"use client";

import { useEffect } from "react";
import Link from "next/link";
import Icon from "../components/Icon.jsx";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("[portal] page error:", error?.message || error);
  }, [error]);

  return (
    <div className="center-state">
      <span className="icon-tile icon-tile-amber"><Icon name="alert" size={28} /></span>
      <h1>Something went wrong</h1>
      <p>The page could not be loaded. No complaint data has been lost.</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>Try again</button>
        <Link href="/" className="btn btn-ghost">Return home</Link>
      </div>
    </div>
  );
}
