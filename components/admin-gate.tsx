"use client";

import { ArrowLeft, ArrowRight, LockKeyhole, Waves } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function AdminGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function enterDashboard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Access could not be verified.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Unable to verify the code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="admin-gate-shell">
    <div className="admin-gate-river" aria-hidden="true"><i /><i /><i /></div>
    <section className="admin-gate-panel">
      <Link className="admin-gate-back" href="/"><ArrowLeft size={15} /> Back to the season</Link>
      <div className="admin-gate-brand"><span><Waves size={21} /></span>FANTASY ROWING <b>/</b> ADMIN</div>
      <div className="admin-gate-icon"><LockKeyhole size={19} /></div>
      <span className="admin-gate-overline">SEASON OPERATIONS</span>
      <h1>Admin access.</h1>
      <p>Enter the access code to manage rowers, schools and race-day results.</p>
      <form onSubmit={enterDashboard}>
        <label htmlFor="admin-access-code">ACCESS CODE</label>
        <input id="admin-access-code" type="password" inputMode="numeric" autoComplete="current-password" autoFocus required value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter code" />
        {error && <span className="admin-gate-error" role="alert">{error}</span>}
        <button disabled={busy}>{busy ? "Checking code…" : <>Enter admin desk <ArrowRight size={16} /></>}</button>
      </form>
      <span className="admin-gate-foot">RESTRICTED ACCESS · AUTHORIZED OPERATORS ONLY</span>
    </section>
  </main>;
}