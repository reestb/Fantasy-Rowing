"use client";

import { ArrowLeft, Check, ImagePlus, Save, ShieldCheck, ShipWheel, Trash2, Trophy, Users, Waves, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ManagedAthlete } from "@/lib/admin-data";

type Tab = "results" | "boat-results" | "athletes" | "schools";
type AthleteDraft = {
  id?: string; full_name: string; school_name: string; year_group: string; age: string;
  event_category: string; boat_class: string; height_cm: string; weight_kg: string;
  erg_score: string; national_ranking: string; photo_url: string; bio: string;
  fantasy_value: string; season_points: string;
};

const emptyAthlete: AthleteDraft = {
  full_name: "", school_name: "", year_group: "", age: "", event_category: "Sweep", boat_class: "",
  height_cm: "", weight_kg: "", erg_score: "", national_ranking: "", photo_url: "", bio: "", fantasy_value: "5.0", season_points: "0",
};

const regattas = ["Schools Head", "National Schools Regatta", "Marlow Regatta", "Henley Royal Regatta", "Henley Women's Regatta", "Junior Sculling Head", "Quintin Head", "School event"];

export default function AdminDesk({ initialAthletes }: { initialAthletes: ManagedAthlete[] }) {
  const [tab, setTab] = useState<Tab>("results");
  const [athletes, setAthletes] = useState(initialAthletes);
  const [draft, setDraft] = useState<AthleteDraft>(emptyAthlete);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultForm, setResultForm] = useState({ athlete_id: "", regatta: regattas[0], event: "Championship VIII", position: "1", time: "", course_record: false, crew_of_the_week: false });
  const [boatResultForm, setBoatResultForm] = useState({ school_boat_id: "", regatta: regattas[0], event: "Championship VIII", position: "1", time: "", course_record: false, crew_of_the_week: false });
  const [schoolForm, setSchoolForm] = useState({ name: "", logo_url: "", head_coach: "", school_colour: "#1f4b70" });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const lockAdmin = () => {
      void fetch("/api/admin/access", { method: "DELETE", keepalive: true });
    };
    const reloadCachedPage = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", lockAdmin);
    window.addEventListener("pageshow", reloadCachedPage);
    return () => {
      window.removeEventListener("pagehide", lockAdmin);
      window.removeEventListener("pageshow", reloadCachedPage);
    };
  }, []);

  const filteredAthletes = useMemo(() => athletes.filter((athlete) => `${athlete.name} ${athlete.school}`.toLowerCase().includes(filter.toLowerCase())), [athletes, filter]);
  const boatOptions = useMemo(() => {
    const boats = new Map<string, { id: string; school: string; name: string; rowers: number }>();
    for (const athlete of athletes) {
      if (!athlete.schoolBoatId || !athlete.schoolId) continue;
      const existing = boats.get(athlete.schoolBoatId);
      if (existing) existing.rowers += 1;
      else boats.set(athlete.schoolBoatId, { id: athlete.schoolBoatId, school: athlete.school, name: athlete.boat, rowers: 1 });
    }
    return Array.from(boats.values()).sort((left, right) => `${left.school} ${left.name}`.localeCompare(`${right.school} ${right.name}`));
  }, [athletes]);

  async function api(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: body instanceof FormData ? {} : { "content-type": "application/json" },
      body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined,
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
    return data;
  }

  async function saveResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const result = await api("/api/admin/results", "POST", {
        ...resultForm,
        subject_type: "athlete",
        subject_id: resultForm.athlete_id,
        position: Number(resultForm.position),
      }) as { athlete_count: number; points_per_athlete: number; total_fantasy_points: number };
      setNotice(`Result saved. ${result.points_per_athlete} fantasy points awarded.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Result could not be saved."); }
    finally { setBusy(false); }
  }

  async function saveBoatResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const result = await api("/api/admin/results", "POST", {
        ...boatResultForm,
        subject_type: "boat",
        subject_id: boatResultForm.school_boat_id,
        position: Number(boatResultForm.position),
      }) as { athlete_count: number; points_per_athlete: number; total_fantasy_points: number };
      setNotice(`Boat result saved for ${result.athlete_count} rowers. Each receives ${result.points_per_athlete} points (${result.total_fantasy_points} total).`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Boat result could not be saved."); }
    finally { setBusy(false); }
  }

  async function saveAthlete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const payload = {
      ...draft,
      year_group: draft.year_group ? Number(draft.year_group) : null,
      age: draft.age ? Number(draft.age) : null,
      height_cm: draft.height_cm ? Number(draft.height_cm) : null,
      weight_kg: draft.weight_kg ? Number(draft.weight_kg) : null,
      national_ranking: draft.national_ranking ? Number(draft.national_ranking) : null,
      fantasy_value: Number(draft.fantasy_value),
      season_points: Number(draft.season_points || 0),
    };
    try {
      const saved = await api("/api/admin/athletes", editing ? "PATCH" : "POST", payload) as { id: string; full_name: string; school_id: string | null; school_boat_id: string | null };
      const managed: ManagedAthlete = {
        id: saved.id, name: payload.full_name, school: payload.school_name || "Independent",
        schoolId: saved.school_id, schoolBoatId: saved.school_boat_id,
        initials: payload.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
        year: payload.year_group ? `Year ${payload.year_group}` : "Year —", boat: payload.boat_class || "Unassigned",
        erg: payload.erg_score || "—", rank: payload.national_ranking || 999, points: payload.season_points,
        price: payload.fantasy_value, trend: "—", color: "#c6d6dd", age: payload.age,
        eventCategory: payload.event_category, height: draft.height_cm, weight: draft.weight_kg,
        photoUrl: payload.photo_url, bio: payload.bio,
      };
      setAthletes((current) => editing ? current.map((athlete) => athlete.id === saved.id ? managed : athlete) : [managed, ...current]);
      setNotice(editing ? "Athlete details updated." : "Athlete added to the database.");
      setDraft(emptyAthlete); setEditing(false);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Athlete could not be saved."); }
    finally { setBusy(false); }
  }

  async function removeAthlete(athlete: ManagedAthlete) {
    if (!window.confirm(`Remove ${athlete.name} from the active athlete list? Past results will be retained.`)) return;
    setBusy(true); setNotice("");
    try {
      await api(`/api/admin/athletes?id=${encodeURIComponent(athlete.id)}`, "DELETE");
      setAthletes((current) => current.filter((item) => item.id !== athlete.id));
      setNotice(`${athlete.name} was archived. Their results remain in the season history.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Athlete could not be removed."); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true); setNotice("");
    try {
      const data = new FormData(); data.append("photo", file);
      const result = await api("/api/admin/upload", "POST", data) as { url: string };
      setDraft((current) => ({ ...current, photo_url: result.url }));
      setNotice("Photo uploaded. Save the athlete to attach it to their profile.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Photo upload failed."); }
    finally { setBusy(false); }
  }

  async function saveSchool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await api("/api/admin/schools", "POST", schoolForm);
      setNotice(`${schoolForm.name} added to the school database.`);
      setSchoolForm({ name: "", logo_url: "", head_coach: "", school_colour: "#1f4b70" });
    } catch (error) { setNotice(error instanceof Error ? error.message : "School could not be saved."); }
    finally { setBusy(false); }
  }

  function editAthlete(athlete: ManagedAthlete) {
    setDraft({ id: athlete.id, full_name: athlete.name, school_name: athlete.school, year_group: athlete.year.match(/\d+/)?.[0] ?? "", age: athlete.age ? String(athlete.age) : "", event_category: athlete.eventCategory, boat_class: athlete.boat === "Unassigned" ? "" : athlete.boat, height_cm: athlete.height, weight_kg: athlete.weight, erg_score: athlete.erg === "—" ? "" : athlete.erg, national_ranking: athlete.rank < 999 ? String(athlete.rank) : "", photo_url: athlete.photoUrl, bio: athlete.bio, fantasy_value: String(athlete.price), season_points: String(athlete.points) });
    setEditing(true); setTab("athletes"); setNotice("");
    document.getElementById("athlete-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function leaveAdminDesk() {
    await fetch("/api/admin/access", { method: "DELETE", keepalive: true });
    window.location.assign("/admin");
  }

  return <div className="admin-shell">
    <header className="admin-topbar"><Link className="admin-brand" href="/" onClick={(event) => { event.preventDefault(); void leaveAdminDesk(); }}><span><Waves size={20} /></span>FANTASY ROWING <b>/</b> ADMIN DESK</Link><Link className="admin-return" href="/" onClick={(event) => { event.preventDefault(); void leaveAdminDesk(); }}><ArrowLeft size={15} /> Back to the season</Link></header>
    <main className="admin-main">
      <div className="admin-heading"><div><span className="admin-eyebrow"><ShieldCheck size={14} /> SEASON OPERATIONS</span><h1>The race is yours to run.</h1><p>Manage rowers, record results and keep the season moving.</p></div><button className="admin-session-exit" onClick={() => void leaveAdminDesk()}><X size={14} /> Lock admin desk</button></div>
      <div className="admin-warning"><ShieldCheck size={16} /><span>Changes here write directly to Supabase. Result points are computed server-side and admin access expires after 12 hours.</span></div>
      {notice && <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
      <div className="admin-tabs">{([{ id: "results", label: "Race results", icon: Trophy }, { id: "boat-results", label: "Boat results", icon: ShipWheel }, { id: "athletes", label: "Athletes", icon: Users }, { id: "schools", label: "Schools", icon: Waves }] as const).map(({ id, label, icon: Icon }) => <button className={tab === id ? "admin-tab-active" : ""} key={id} onClick={() => { setTab(id); setNotice(""); }}><Icon size={16} />{label}</button>)}</div>

      {tab === "results" && <div className="admin-columns"><section className="admin-panel"><div className="admin-panel-title"><div><span>RACE-DAY DATA</span><h2>Enter a result</h2></div><span className="admin-panel-icon"><Trophy size={18} /></span></div><form className="admin-form" onSubmit={saveResult}><label>ATHLETE<select required value={resultForm.athlete_id} onChange={(event) => setResultForm({ ...resultForm, athlete_id: event.target.value })}><option value="">Select a rower</option>{athletes.map((athlete) => <option value={athlete.id} key={athlete.id}>{athlete.name} · {athlete.school}</option>)}</select></label><label>REGATTA<select value={resultForm.regatta} onChange={(event) => setResultForm({ ...resultForm, regatta: event.target.value })}>{regattas.map((regatta) => <option key={regatta}>{regatta}</option>)}</select></label><label className="admin-field-wide">EVENT<input required value={resultForm.event} onChange={(event) => setResultForm({ ...resultForm, event: event.target.value })} placeholder="e.g. Championship VIII" /></label><div className="admin-form-two"><label>FINISH POSITION<input required type="number" min="1" step="1" value={resultForm.position} onChange={(event) => setResultForm({ ...resultForm, position: event.target.value })} /></label><label>TIME<input value={resultForm.time} onChange={(event) => setResultForm({ ...resultForm, time: event.target.value })} placeholder="e.g. 06:12.4" /></label></div><div className="admin-checks"><label><input type="checkbox" checked={resultForm.course_record} onChange={(event) => setResultForm({ ...resultForm, course_record: event.target.checked })} /><span>Course record <b>+25</b></span></label><label><input type="checkbox" checked={resultForm.crew_of_the_week} onChange={(event) => setResultForm({ ...resultForm, crew_of_the_week: event.target.checked })} /><span>Crew of the week <b>+20</b></span></label></div><div className="scoring-note"><Trophy size={16} /><span><strong>Scoring is automatic</strong><small>Win 50 · Silver 40 · Bronze 30 · Top 10 15 · Captain scores double.</small></span></div><button className="admin-submit" disabled={busy}><Save size={16} />{busy ? "Saving result…" : "Save race result"}</button></form></section><section className="admin-side-note"><span className="admin-eyebrow">THE RACE BOOK</span><h2>Every result<br />moves the table.</h2><p>Saved finishes update the athlete&apos;s season points and appear in their result history. Bonus points are added to the base finish score automatically.</p><div className="points-cheatsheet"><span>RACE WIN <b>50</b></span><span>SILVER <b>40</b></span><span>BRONZE <b>30</b></span><span>TOP TEN <b>15</b></span><span>COURSE RECORD <b>+25</b></span><span>CREW OF THE WEEK <b>+20</b></span></div></section></div>}

      {tab === "athletes" && <div className="admin-columns athlete-admin-layout"><section className="admin-panel" id="athlete-form"><div className="admin-panel-title"><div><span>{editing ? "EDIT ATHLETE" : "ATHLETE DATABASE"}</span><h2>{editing ? "Update the details" : "Add a rower"}</h2></div>{editing && <button className="admin-cancel" onClick={() => { setEditing(false); setDraft(emptyAthlete); }}>Cancel</button>}</div><form className="admin-form" onSubmit={saveAthlete}><div className="admin-form-two"><label>FULL NAME<input required value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} placeholder="Name as it appears on results" /></label><label>SCHOOL<input value={draft.school_name} onChange={(event) => setDraft({ ...draft, school_name: event.target.value })} placeholder="School name" /></label></div><div className="admin-form-three"><label>YEAR GROUP<input type="number" min="7" max="14" value={draft.year_group} onChange={(event) => setDraft({ ...draft, year_group: event.target.value })} placeholder="13" /></label><label>AGE<input type="number" min="12" max="19" value={draft.age} onChange={(event) => setDraft({ ...draft, age: event.target.value })} placeholder="17" /></label><label>EVENT CATEGORY<select value={draft.event_category} onChange={(event) => setDraft({ ...draft, event_category: event.target.value })}><option>Sweep</option><option>Sculling</option><option>Both</option></select></label></div><div className="admin-form-three"><label>BOAT CLASS<input value={draft.boat_class} onChange={(event) => setDraft({ ...draft, boat_class: event.target.value })} placeholder="1st VIII" /></label><label>HEIGHT · CM<input type="number" min="120" max="230" value={draft.height_cm} onChange={(event) => setDraft({ ...draft, height_cm: event.target.value })} placeholder="188" /></label><label>WEIGHT · KG<input type="number" min="35" max="140" value={draft.weight_kg} onChange={(event) => setDraft({ ...draft, weight_kg: event.target.value })} placeholder="82" /></label></div><div className="admin-form-three"><label>2K ERG SCORE<input value={draft.erg_score} onChange={(event) => setDraft({ ...draft, erg_score: event.target.value })} placeholder="6:12.4" /></label><label>NATIONAL RANK<input type="number" min="1" value={draft.national_ranking} onChange={(event) => setDraft({ ...draft, national_ranking: event.target.value })} placeholder="12" /></label><label>FANTASY VALUE · £M<input type="number" min="0" max="100" step="0.1" value={draft.fantasy_value} onChange={(event) => setDraft({ ...draft, fantasy_value: event.target.value })} /></label></div><label>ATHLETE BIO<textarea rows={2} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="A short introduction to this rower" /></label><div className="photo-upload"><label className="photo-pick"><ImagePlus size={16} /><span>{draft.photo_url ? "Replace profile photo" : "Upload profile photo"}<small>JPG, PNG or WebP · 5 MB max</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(event.target.files?.[0])} /></label>{draft.photo_url && <span className="photo-ready"><Check size={13} /> Photo ready</span>}</div><button className="admin-submit" disabled={busy}><Save size={16} />{busy ? "Saving athlete…" : editing ? "Save athlete changes" : "Add athlete"}</button></form></section><section className="admin-panel admin-roster-panel"><div className="admin-panel-title"><div><span>ACTIVE ATHLETES</span><h2>The roster <small>{athletes.length}</small></h2></div><label className="roster-search"><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter roster" /></label></div><div className="admin-roster-list">{filteredAthletes.map((athlete) => <div className="admin-roster-row" key={athlete.id}><i style={{ background: athlete.color }}>{athlete.initials}</i><span><strong>{athlete.name}</strong><small>{athlete.school} · £{athlete.price.toFixed(1)}m · {athlete.points} pts</small></span><button onClick={() => editAthlete(athlete)} aria-label={`Edit ${athlete.name}`} title="Edit athlete"><Save size={14} /></button><button className="delete-athlete" onClick={() => void removeAthlete(athlete)} aria-label={`Archive ${athlete.name}`} title="Archive athlete"><Trash2 size={14} /></button></div>)}{filteredAthletes.length === 0 && <p className="admin-empty">No matching rowers.</p>}</div></section></div>}

      {tab === "schools" && <div className="admin-columns"><section className="admin-panel"><div className="admin-panel-title"><div><span>THE SCHOOL DATABASE</span><h2>Add a school</h2></div><span className="admin-panel-icon"><Waves size={18} /></span></div><form className="admin-form" onSubmit={saveSchool}><label>SCHOOL NAME<input required value={schoolForm.name} onChange={(event) => setSchoolForm({ ...schoolForm, name: event.target.value })} placeholder="Full school name" /></label><label>HEAD COACH<input value={schoolForm.head_coach} onChange={(event) => setSchoolForm({ ...schoolForm, head_coach: event.target.value })} placeholder="Coach name" /></label><label>LOGO IMAGE URL<input type="url" value={schoolForm.logo_url} onChange={(event) => setSchoolForm({ ...schoolForm, logo_url: event.target.value })} placeholder="https://…" /></label><label className="school-color-field">SCHOOL COLOUR <span><input type="color" value={schoolForm.school_colour} onChange={(event) => setSchoolForm({ ...schoolForm, school_colour: event.target.value })} />{schoolForm.school_colour}</span></label><button className="admin-submit" disabled={busy}><Save size={16} />{busy ? "Saving school…" : "Add school"}</button></form></section><section className="admin-side-note"><span className="admin-eyebrow">A CREST ON THE WATER</span><h2>Every school<br />has its colours.</h2><p>School details are linked to athlete profiles and contribute to the school fantasy standings. Add a school before its first rower, or enter a new school while creating an athlete.</p><div className="scoring-note"><Users size={16} /><span><strong>Squad size is automatic</strong><small>Counts active athletes assigned to each school.</small></span></div></section></div>}
      {tab === "boat-results" && <div className="admin-columns"><section className="admin-panel"><div className="admin-panel-title"><div><span>CREW RACE-DAY DATA</span><h2>Enter a boat result</h2></div><span className="admin-panel-icon"><ShipWheel size={18} /></span></div><form className="admin-form" onSubmit={saveBoatResult}><label>SCHOOL BOAT<select required value={boatResultForm.school_boat_id} onChange={(event) => setBoatResultForm({ ...boatResultForm, school_boat_id: event.target.value })}><option value="">Choose a registered school boat</option>{boatOptions.map((boat) => <option value={boat.id} key={boat.id}>{boat.school} · {boat.name} · {boat.rowers} rowers</option>)}</select></label>{boatOptions.length === 0 && <p className="boat-empty-note">No registered school boats yet. Add rowers with a school and boat class in the Athletes tab first.</p>}<label>REGATTA<select value={boatResultForm.regatta} onChange={(event) => setBoatResultForm({ ...boatResultForm, regatta: event.target.value })}>{regattas.map((regatta) => <option key={regatta}>{regatta}</option>)}</select></label><label>EVENT<input required value={boatResultForm.event} onChange={(event) => setBoatResultForm({ ...boatResultForm, event: event.target.value })} placeholder="e.g. Championship VIII" /></label><div className="admin-form-two"><label>FINISH POSITION<input required type="number" min="1" step="1" value={boatResultForm.position} onChange={(event) => setBoatResultForm({ ...boatResultForm, position: event.target.value })} /></label><label>TIME<input value={boatResultForm.time} onChange={(event) => setBoatResultForm({ ...boatResultForm, time: event.target.value })} placeholder="e.g. 06:12.4" /></label></div><div className="admin-checks"><label><input type="checkbox" checked={boatResultForm.course_record} onChange={(event) => setBoatResultForm({ ...boatResultForm, course_record: event.target.checked })} /><span>Course record <b>+25</b></span></label><label><input type="checkbox" checked={boatResultForm.crew_of_the_week} onChange={(event) => setBoatResultForm({ ...boatResultForm, crew_of_the_week: event.target.checked })} /><span>Crew of the week <b>+20</b></span></label></div><div className="scoring-note"><Users size={16} /><span><strong>Points go to every active rower registered with this boat.</strong><small>Race position and bonuses are applied to each crew member.</small></span></div><button className="admin-submit" disabled={busy || boatOptions.length === 0}><Save size={16} />{busy ? "Saving result…" : "Save boat result"}</button></form></section><section className="admin-side-note"><span className="admin-eyebrow">REGISTERED CREW</span><h2>One result.<br />Every seat.</h2><p>Boat membership comes from each athlete’s school and boat class in the Athletes tab. Check the roster before entering a crew finish.</p></section></div>}
      <footer className="admin-footer"><span>FANTASY ROWING · SEASON OPERATIONS</span><span>RACE WELL. ROW WELL. <Waves size={13} /></span></footer>
    </main>
  </div>;
}