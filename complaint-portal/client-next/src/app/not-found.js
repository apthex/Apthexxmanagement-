import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="center-state">
      <p className="eyebrow">404</p>
      <h1>That page could not be found</h1>
      <p>The link may be old, or the page may have moved. No complaint data is shown on this page.</p>
      <div className="row">
        <Link href="/" className="btn btn-primary">Report a concern</Link>
        <Link href="/status" className="btn btn-ghost">Check status</Link>
      </div>
    </div>
  );
}
