"use client";

import { ArrowLeft, Check, LogOut, Save, Waves } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { ManagerProfile, SchoolOption } from "@/lib/profile";

export default function AccountDesk() {
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void fetch("/api/profile").then(async (response) => {
      const result = await response.json() as { error?: string; profile?: ManagerProfile; schools?: SchoolOption[] };
      if (!response.ok) throw new Error(result.error ?? "Could not load your account.");
      if (!result.profile) throw new Error("Your profile has not been created. Re-run the database setup scripts.");
      setProfile(result.profile);
      setDisplayName(result.profile.display_name);
      setSchoolId(result.profile.supported_school_id ?? "");
      setSchools(result.schools ?? []);
    }).catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "Could not load your account.");
    }).finally(() => setBusy(false));
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: displayName, supported_school_id: schoolId || null }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save your profile.");
      setProfile((current) => current ? {
        ...current,
        display_name: displayName.trim(),
        supported_school_id: schoolId || null,
        supported_school_name: schools.find((school) => school.id === schoolId)?.name ?? null,
      } : current);
      setNotice("Your profile has been saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your profile.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) await createBrowserClient(url, key).auth.signOut();
    window.location.assign("/sign-in");
  }

  return <main className="account-shell">
    <header className="account-topbar"><Link className="account-brand" href="/"><span><Waves size={20} /></span>FANTASY ROWING <b>/</b> YOUR ACCOUNT</Link><Link className="account-back" href="/"><ArrowLeft size={14} /> Back to the season</Link></header>
    <div className="account-content">
      <span className="admin-eyebrow">YOUR MANAGER PROFILE</span>
      <h1>Make it your season.</h1>
      <p className="account-intro">Your profile and crew are saved to your account and follow you between devices.</p>
      {notice && <div className="account-notice" role="status">{notice}</div>}
      <div className="account-grid">
        <section className="account-panel">
          <div className="account-panel-title"><div><span>PROFILE DETAILS</span><h2>The name on your crew sheet.</h2></div></div>
          <form className="account-form" onSubmit={saveProfile}>
            <label htmlFor="display-name">DISPLAY NAME</label>
            <input id="display-name" required minLength={2} maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
            <label htmlFor="supported-school">SCHOOL YOU SUPPORT</label>
            <select id="supported-school" value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
              <option value="">Choose a school</option>
              {schools.map((school) => <option value={school.id} key={school.id}>{school.name}</option>)}
            </select>
            <button className="account-save" disabled={busy}><Save size={15} />{busy ? "Loading…" : "Save profile"}</button>
          </form>
        </section>
        <section className="account-panel account-stats-panel">
          <div className="account-panel-title"><div><span>YOUR SEASON</span><h2>Current account stats.</h2></div></div>
          <div className="account-stats">
            <div><span>CREW</span><strong>{profile?.team_name ?? "No crew saved"}</strong></div>
            <div><span>SEASON POINTS</span><strong>{profile?.total_points ?? 0}</strong></div>
            <div><span>GLOBAL POSITION</span><strong>{profile?.overall_rank ? `#${profile.overall_rank}` : "—"}</strong></div>
            <div><span>CREW VALUE</span><strong>{profile?.team_value == null ? "—" : `£${Number(profile.team_value).toFixed(1)}m`}</strong></div>
            <div><span>BEST FINISH</span><strong>{profile?.best_finish ? `#${profile.best_finish}` : "—"}</strong></div>
          </div>
          <Link className="account-team-link" href="/?view=squad">Manage your crew <ArrowLeft size={14} /></Link>
        </section>
      </div>
      <button className="account-signout" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
      {notice === "Your profile has been saved." && <span className="account-saved"><Check size={13} /> Saved to your account</span>}
    </div>
  </main>;
}