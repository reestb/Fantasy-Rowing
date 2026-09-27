"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crown,
  Flame,
  Flag,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShipWheel,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  Users,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Athlete } from "@/lib/athletes";
import type { ManagerProfile } from "@/lib/profile";

type View = "overview" | "squad" | "players" | "leagues" | "calendar";
const BUDGET = 100;
const NAV = [
  { id: "overview" as const, label: "Overview", icon: Waves },
  { id: "squad" as const, label: "My crew", icon: ShipWheel },
  { id: "players" as const, label: "Rowers", icon: Users },
  { id: "leagues" as const, label: "Leaderboards", icon: Trophy },
  { id: "calendar" as const, label: "Race calendar", icon: CalendarDays },
];

const races = [
  { day: "—", month: "TBC", title: "Schools Head of the River", place: "Championship Course, London", type: "HEAD RACE", color: "blue" },
  { day: "—", month: "TBC", title: "National Schools Regatta", place: "Dorney Lake, Eton", type: "REGATTA", color: "gold" },
  { day: "—", month: "TBC", title: "Marlow Regatta", place: "Dorney Lake, Eton", type: "REGATTA", color: "red" },
];

export default function FantasyDashboard({ initialAthletes }: { initialAthletes: Athlete[] }) {
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [teamName, setTeamName] = useState("My Crew");
  const [query, setQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("All schools");
  const [yearFilter, setYearFilter] = useState("Any year");
  const [boatFilter, setBoatFilter] = useState("Any boat");
  const [rankFilter, setRankFilter] = useState("any");
  const [pointsFilter, setPointsFilter] = useState("any");
  const [ergFilter, setErgFilter] = useState("any");
  const [sortBy, setSortBy] = useState<"points" | "price" | "rank">("points");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "squad") setView("squad");
    let mounted = true;
    void fetch("/api/profile").then(async (response) => {
      const data = await response.json() as { error?: string; profile?: ManagerProfile };
      if (!response.ok) throw new Error(data.error ?? "Profile stats are unavailable.");
      if (!mounted || !data.profile) return;
      setProfile(data.profile);
      setTeamName(data.profile.team_name || "My Crew");
    }).catch((error: unknown) => {
      if (mounted && error instanceof Error && error.message.includes("get_manager_dashboard")) {
        setNotice("Run supabase/personalization.sql in Supabase to enable saved profile stats.");
      }
    });
    void fetch("/api/team").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { team?: { team_athletes?: { athlete_id: string; is_captain: boolean; removed_at: string | null }[] } | null };
      const activePicks = data.team?.team_athletes?.filter((pick) => !pick.removed_at) ?? [];
      if (mounted && activePicks.length === 8) {
        const ids = activePicks.map((pick) => pick.athlete_id);
        const captainPick = activePicks.find((pick) => pick.is_captain);
        setSelected(ids);
        setCaptain(captainPick?.athlete_id ?? null);
        setSaved(Boolean(captainPick));
      } else if (mounted) {
        setSelected([]);
        setCaptain(null);
        setSaved(false);
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const selectedAthletes = initialAthletes.filter((athlete) => selected.includes(athlete.id));
  const spend = selectedAthletes.reduce((sum, athlete) => sum + athlete.price, 0);
  const remaining = BUDGET - spend;
  const available = useMemo(() => initialAthletes
    .filter((athlete) => !query || `${athlete.name} ${athlete.school} ${athlete.boat}`.toLowerCase().includes(query.toLowerCase()))
    .filter((athlete) => schoolFilter === "All schools" || athlete.school === schoolFilter)
    .filter((athlete) => yearFilter === "Any year" || athlete.year === yearFilter)
    .filter((athlete) => boatFilter === "Any boat" || athlete.boat === boatFilter)
    .filter((athlete) => rankFilter === "any" || athlete.rank <= Number(rankFilter))
    .filter((athlete) => pointsFilter === "any" || athlete.points >= Number(pointsFilter))
    .filter((athlete) => ergFilter === "any" || (ergSeconds(athlete.erg) !== null && ergSeconds(athlete.erg)! < Number(ergFilter)))
    .sort((left, right) => sortBy === "price" ? right.price - left.price : sortBy === "rank" ? left.rank - right.rank : right.points - left.points),
  [initialAthletes, query, schoolFilter, yearFilter, boatFilter, rankFilter, pointsFilter, ergFilter, sortBy]);

  function toggleAthlete(athlete: Athlete) {
    setSaved(false);
    if (selected.includes(athlete.id)) {
      setSelected((current) => current.filter((id) => id !== athlete.id));
      if (captain === athlete.id) setCaptain(null);
      return;
    }
    if (selected.length >= 8) {
      setNotice("Your crew is full. Remove a rower before making another transfer.");
      return;
    }
    if (spend + athlete.price > BUDGET) {
      setNotice("That transfer would put you over the £100m budget.");
      return;
    }
    setNotice("");
    setSelected((current) => [...current, athlete.id]);
  }

  async function saveTeam() {
    if (selected.length !== 8) {
      setNotice("Pick 8 rowers before saving your crew.");
      return;
    }
    if (!captain || !selected.includes(captain)) {
      setNotice("Choose a captain to complete your crew.");
      return;
    }
    try {
      const response = await fetch("/api/team", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ athlete_ids: selected, captain_id: captain, team_name: teamName }),
      });
      if (response.ok) {
        setSaved(true);
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const data = await profileResponse.json() as { profile?: ManagerProfile };
          if (data.profile) setProfile(data.profile);
        }
        setNotice("Crew synced to your account. You're ready for the next race day.");
      } else {
        const result = await response.json() as { error?: string };
        setNotice(`Crew not saved. ${result.error ?? "Please sign in again and retry."}`);
      }
    } catch {
      setNotice("Crew not saved. Check your connection and try again.");
    }
  }

  function chooseView(nextView: View) {
    setView(nextView);
    setMobileOpen(false);
    setNotice("");
  }

  const pageTitle: Record<View, string> = {
    overview: "The season starts here.",
    squad: "Build your crew.",
    players: "Find your next pick.",
    leagues: "The league table.",
    calendar: "Race day, circled.",
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileOpen ? " sidebar-open" : ""}`}>
        <a className="brand" href="#top" onClick={() => chooseView("overview")} aria-label="Fantasy Rowing home">
          <span className="brand-mark"><Waves size={22} strokeWidth={2.3} /></span>
          <span className="brand-wordmark">fantasy<span>rowing</span></span>
        </a>
        <div className="season-switch"><span className="season-dot" /> 2026 / 27 SEASON <ChevronDown size={14} /></div>
        <div className="nav-label">YOUR WATER</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item${view === id ? " nav-active" : ""}`} key={id} onClick={() => chooseView(id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === "squad" && selected.length > 0 && <span className="nav-count">{selected.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="nav-label">YOUR LEAGUES</div>
        <button className="create-league" onClick={() => chooseView("leagues")}><Plus size={15} /> Private leagues</button>
        <a className="admin-shortcut" href="/admin"><ShieldCheck size={14} /> Admin desk <ChevronRight size={13} /></a>
        <div className="sidebar-bottom">
          <div className="season-card"><div className="season-card-top"><Sparkles size={15} /> QUICK REMINDER</div><p>Every seat counts.</p><span>Race-day points are earned by your full eight.</span></div>
          <Link className="profile-button" href="/account">
            <span className="profile-avatar">{profile?.display_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "FR"}</span><span className="profile-name"><strong>{profile?.display_name ?? "Your account"}</strong><small>{profile?.supported_school_name ?? "Account settings"}</small></span><Settings2 size={17} />
          </Link>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <main className="main-area" id="top">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>2026 / 27</span><ChevronRight size={13} /><strong>{NAV.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button help-button" aria-label="Help" title="Help"><CircleHelp size={18} /></button>
            <button className="icon-button" aria-label="Notifications" title="Notifications" onClick={() => setNotice("You're all caught up on race-day news.")}><Bell size={18} /><i className="notification-dot" /></button>
            <Link className="top-avatar profile-top-link" href="/account" title="Manage profile" aria-label="Manage your profile">{profile?.display_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "FR"}</Link>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> BRITISH JUNIOR ROWING, REIMAGINED</div><h1>{view === "overview" && profile?.display_name ? `Welcome back, ${profile.display_name.split(" ")[0]}.` : pageTitle[view]}</h1><p>{view === "overview" && profile?.supported_school_name ? `Your season, racing for ${profile.supported_school_name}.` : "Pick your eight. Follow the racing. Make every stroke count."}</p></div>
            <button className="round-help" aria-label="More information" title="Fantasy Rowing scoring: wins 50, silver 40, bronze 30, top 10 15; course record +25; crew of the week +20. Captain scores double."><CircleHelp size={18} /></button>
          </section>

          {notice && <div className={`notice${saved && notice.startsWith("Crew saved") ? " notice-success" : ""}`} role="status"><span>{saved && notice.startsWith("Crew saved") ? <Check size={16} /> : <Flag size={16} />}</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}

          {view === "overview" && <Overview athletes={initialAthletes} teamCount={selected.length} profile={profile} onBuild={() => chooseView("squad")} onLeague={() => chooseView("leagues")} onPlayers={() => chooseView("players")} />}
          {(view === "squad" || view === "players") && (
            <SquadBuilder
              athletes={available}
              selectedAthletes={selectedAthletes}
              selected={selected}
              captain={captain}
              spend={spend}
              remaining={remaining}
              saved={saved}
              teamName={teamName}
              query={query}
              schoolFilter={schoolFilter}
              yearFilter={yearFilter}
              boatFilter={boatFilter}
              rankFilter={rankFilter}
              pointsFilter={pointsFilter}
              ergFilter={ergFilter}
              schools={Array.from(new Set(initialAthletes.map((athlete) => athlete.school)))}
              years={Array.from(new Set(initialAthletes.map((athlete) => athlete.year)))}
              boats={Array.from(new Set(initialAthletes.map((athlete) => athlete.boat)))}
              sortBy={sortBy}
              setQuery={setQuery}
              setTeamName={(value) => { setTeamName(value); setSaved(false); }}
              setSchoolFilter={setSchoolFilter}
              setYearFilter={setYearFilter}
              setBoatFilter={setBoatFilter}
              setRankFilter={setRankFilter}
              setPointsFilter={setPointsFilter}
              setErgFilter={setErgFilter}
              setSortBy={setSortBy}
              onToggle={toggleAthlete}
              onCaptain={setCaptain}
              onSave={saveTeam}
              onNotice={setNotice}
            />
          )}
          {view === "leagues" && <LeagueView onBuild={() => chooseView("squad")} />}
          {view === "calendar" && <CalendarView />}

          <footer className="page-footer"><span>AN INDEPENDENT CELEBRATION OF SCHOOL ROWING</span><span>MADE FOR THE LOVE OF THE RACE <Waves size={14} /></span></footer>
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {NAV.filter((item) => ["overview", "squad", "players", "leagues"].includes(item.id)).map(({ id, icon: Icon }) => (
          <button key={id} className={view === id ? "mobile-nav-active" : ""} onClick={() => chooseView(id)}><Icon size={18} /><span>{id === "overview" ? "Home" : id === "squad" ? "Crew" : id === "players" ? "Rowers" : "Leagues"}</span></button>
        ))}
      </nav>
    </div>
  );
}

function Overview({ athletes, teamCount, profile, onBuild, onLeague, onPlayers }: { athletes: Athlete[]; teamCount: number; profile: ManagerProfile | null; onBuild: () => void; onLeague: () => void; onPlayers: () => void }) {
  const leading = athletes.slice(0, 4);
  const schoolStandings = Array.from(athletes.reduce((totals, athlete) => {
    const current = totals.get(athlete.school) ?? { points: 0, color: athlete.color };
    current.points += athlete.points;
    totals.set(athlete.school, current);
    return totals;
  }, new Map<string, { points: number; color: string }>()).entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((left, right) => right.points - left.points)
    .slice(0, 4);
  const valuePick = athletes.reduce<Athlete | null>((best, athlete) => !best || athlete.price < best.price ? athlete : best, null);
  return <>
    <section className="hero-panel">
      <div className="hero-copy"><div className="hero-kicker"><span className="live-pulse" /> THE 2026 / 27 SEASON IS AHEAD</div><h2>Eight rowers.<br />One <em>season</em> to own.</h2><p>Your crew is waiting. Find the names to watch, pick a captain, and get yourself on the water.</p><button className="hero-cta" onClick={onBuild}>{teamCount === 8 ? "Manage your crew" : "Pick your crew"}<ArrowRight size={17} /></button><div className="hero-proof"><span><Users size={14} /> Build your crew</span><i /> <span><Flag size={14} /> 7 regattas</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="art-sun" /><div className="art-horizon" /><div className="art-water water-one" /><div className="art-water water-two" /><div className="art-water water-three" /><div className="art-boat"><span /><span /><span /><span /><b /></div><span className="art-label">THE RIVER IS YOURS</span><span className="art-coordinate">51° 29&apos; N · 00° 13&apos; W</span></div>
      <div className="hero-index"><span>01</span><span>—</span><span>04</span></div>
    </section>

    <section className="metrics-grid" aria-label="Season statistics">
      <Metric label="YOUR SEASON POINTS" value={profile?.team_id ? String(profile.total_points) : "—"} foot={profile?.team_id ? "Including captain bonus" : "Save your first crew"} accent="blue" icon={<Waves size={17} />} />
      <Metric label="GLOBAL POSITION" value={profile?.overall_rank ? `#${profile.overall_rank}` : "—"} foot={profile?.team_id ? "Season standings" : "Your name belongs here"} accent="gold" icon={<Trophy size={17} />} />
      <Metric label="CREW VALUE" value={profile?.team_id && profile.team_value != null ? `£${Number(profile.team_value).toFixed(1)}m` : "—"} foot={profile?.team_id ? (profile.team_name || "Your saved crew") : `${teamCount} of 8 rowers selected`} accent="red" icon={<ShipWheel size={17} />} />
      <Metric label="NEXT RACE DAY" value="TBC" foot="Schools Head · dates to follow" accent="green" icon={<CalendarDays size={17} />} />
    </section>

    <div className="dashboard-grid">
      <section className="content-panel leaderboard-panel">
        <div className="panel-heading"><div><span className="panel-overline">THE FORM GUIDE</span><h3>Rower rankings</h3></div><button className="text-link" onClick={onPlayers}>All rowers <ArrowRight size={14} /></button></div>
        {leading.length === 0 ? <div className="empty-results">No athlete results yet. Rowers and race results entered by admins will appear here.</div> : <div className="ranking-table"><div className="table-head rank-row"><span>RANK</span><span>ATHLETE</span><span>ERG</span><span>POINTS</span><span>FORM</span></div>{leading.map((athlete) => <AthleteRankRow key={athlete.id} athlete={athlete} />)}</div>}
        <div className="panel-footnote"><span><i className="table-status-dot" /> {leading.length ? "ATHLETE DATA FROM THE DATABASE" : "WAITING FOR REAL ROWERS"}</span><span>VIEW ALL ROWERS <ArrowRight size={12} /></span></div>
      </section>
      <section className="content-panel race-panel">
        <div className="panel-heading"><div><span className="panel-overline">ON THE HORIZON</span><h3>Next on the water</h3></div><span className="season-tag">SPRING TERM</span></div>
        <div className="race-list">{races.slice(0, 2).map((race) => <RaceRow key={race.title} race={race} />)}</div>
        <div className="race-panel-bottom"><span>THE SEASON, AT A GLANCE</span><span>7 REGATTAS <ArrowRight size={13} /></span></div>
      </section>
    </div>

    <div className="bottom-grid">
      <section className="feature-strip feature-week"><div className="feature-icon gold-icon"><Star size={19} fill="currentColor" /></div><div className="feature-copy"><span>SEASON POINTS LEADER</span><strong>{athletes[0]?.name ?? "Waiting for race results"}</strong><small>{athletes[0] ? `${athletes[0].school} · ${athletes[0].points} points` : "Admin-entered scores appear here."}</small></div><div className="feature-number">01</div></section>
      <section className="feature-strip feature-rising"><div className="feature-icon blue-icon"><Flame size={19} /></div><div className="feature-copy"><span>NEXT IN POINTS</span><strong>{athletes[1]?.name ?? "No second scorer yet"}</strong><small>{athletes[1] ? `${athletes[1].school} · ${athletes[1].points} points` : "Race results will build this list."}</small></div><div className="feature-number">02</div></section>
      <section className="feature-strip feature-transfer"><div className="feature-icon red-icon"><ArrowRight size={19} /></div><div className="feature-copy"><span>LOWEST FANTASY VALUE</span><strong>{valuePick?.name ?? "No athletes listed"}</strong><small>{valuePick ? `${valuePick.school} · £${valuePick.price.toFixed(1)}m` : "The athlete database is empty."}</small></div></section>
    </div>

    <div className="lower-grid">
      <section className="content-panel school-panel"><div className="panel-heading"><div><span className="panel-overline">THE SCHOOL TABLE</span><h3>Racing for the crest</h3></div><button className="text-link" onClick={onLeague}>Your leagues <ArrowRight size={14} /></button></div>{schoolStandings.length === 0 ? <div className="empty-results">School points will be calculated from real athlete race results.</div> : <div className="school-table"><div className="school-table-head"><span>SCHOOL</span><span>FANTASY PTS</span><span>POS</span></div>{schoolStandings.map((school, index) => <div className="school-row" key={school.name}><span className="school-identity"><b>{String(index + 1).padStart(2, "0")}</b><i className="school-crest" style={{ "--crest": school.color } as React.CSSProperties}>{school.name.slice(0, 1)}</i><strong>{school.name}</strong></span><span className="school-points">{school.points.toLocaleString("en-GB")}</span><span className="change-up">{index + 1}</span></div>)}</div>}</section>
      <section className="content-panel crew-panel"><div className="panel-heading"><div><span className="panel-overline">YOUR SCHOOL</span><h3>{profile?.supported_school_name ?? "Choose your school"}</h3></div><span className="week-badge">ACCOUNT</span></div><div className="crew-illustration"><div className="crew-water" /><div className="crew-oar oar-left" /><div className="crew-oar oar-right" /><div className="crew-seats"><i /><i /><i /><i /></div><div className="crew-shell" /></div><div className="crew-caption"><div><strong>{profile?.supported_school_name ?? "No school selected yet"}</strong><span>{schoolStandings.find((school) => school.name === profile?.supported_school_name)?.points ?? 0} fantasy points from recorded race results</span></div></div><div className="crew-quote">{profile?.supported_school_name ? "Your supported school, based on live athlete results." : "Set your supported school from your account profile."}</div></section>
    </div>
  </>;
  return <div className="calendar-page"><div className="calendar-intro"><div><span className="panel-overline">2026 / 27 RACING SEASON · DATES TO FOLLOW</span><h3>Mark the good days.</h3><p>Seven fixtures. One season. Follow every start from the first head race to the final Henley reach.</p></div><div className="calendar-count"><strong>07</strong><span>REGATTAS<br />THIS SEASON</span></div></div><div className="calendar-month"><span>THE SEASON AHEAD</span><i /></div><div className="calendar-events">{races.map((race) => <RaceRow key={race.title} race={race} />)}{[{ day: "—", month: "TBC", title: "Henley Royal Regatta", place: "Henley-on-Thames", type: "REGATTA", color: "blue" }, { day: "—", month: "TBC", title: "Henley Women's Regatta", place: "Henley-on-Thames", type: "REGATTA", color: "gold" }, { day: "—", month: "TBC", title: "Junior Sculling Head", place: "Dorney Lake, Eton", type: "HEAD RACE", color: "red" }, { day: "—", month: "TBC", title: "Quintin Head", place: "River Thames, London", type: "HEAD RACE", color: "blue" }].map((race) => <RaceRow key={race.title} race={race} />)}</div><div className="calendar-note"><Sparkles size={17} /><span><strong>School fixtures are welcome here.</strong> Admins can add school events as the season schedule is confirmed.</span></div></div>;
}

function Metric({ label, value, foot, accent, icon }: { label: string; value: string; foot: string; accent: string; icon: React.ReactNode }) {
  return <div className={`metric metric-${accent}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{foot}</small></div>;
}

function AthleteRankRow({ athlete }: { athlete: Athlete }) {
  return <div className="rank-row athlete-row"><span className="rank-number">{String(athlete.rank).padStart(2, "0")}</span><Link className="athlete-cell athlete-profile-link" href={`/athletes/${athlete.id}`}><i className="athlete-avatar" style={{ "--avatar": athlete.color } as React.CSSProperties}>{athlete.initials}</i><span><strong>{athlete.name}</strong><small>{athlete.school}</small></span></Link><span className="erg-cell">{athlete.erg}</span><span className="points-cell">{athlete.points}<small>pts</small></span><span className="form-cell"><ArrowUpRight size={14} /> {athlete.trend.replace("+", "")}</span></div>;
}

function RaceRow({ race }: { race: typeof races[number] }) {
  return <div className="race-row"><div className={`race-date date-${race.color}`}><strong>{race.day}</strong><small>{race.month}</small></div><div className="race-detail"><span>{race.type}</span><strong>{race.title}</strong><small>{race.place}</small></div><ChevronRight className="race-arrow" size={17} /></div>;
}

function ergSeconds(score: string): number | null {
  const match = score.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function SquadBuilder({ athletes, selectedAthletes, selected, captain, spend, remaining, saved, teamName, query, schoolFilter, yearFilter, boatFilter, rankFilter, pointsFilter, ergFilter, schools: schoolNames, years, boats, sortBy, setQuery, setTeamName, setSchoolFilter, setYearFilter, setBoatFilter, setRankFilter, setPointsFilter, setErgFilter, setSortBy, onToggle, onCaptain, onSave, onNotice }: {
  athletes: Athlete[]; selectedAthletes: Athlete[]; selected: string[]; captain: string | null; spend: number; remaining: number; saved: boolean; teamName: string; query: string; schoolFilter: string; yearFilter: string; boatFilter: string; rankFilter: string; pointsFilter: string; ergFilter: string; schools: string[]; years: string[]; boats: string[]; sortBy: "points" | "price" | "rank"; setQuery: (value: string) => void; setTeamName: (value: string) => void; setSchoolFilter: (value: string) => void; setYearFilter: (value: string) => void; setBoatFilter: (value: string) => void; setRankFilter: (value: string) => void; setPointsFilter: (value: string) => void; setErgFilter: (value: string) => void; setSortBy: (value: "points" | "price" | "rank") => void; onToggle: (athlete: Athlete) => void; onCaptain: (id: string) => void; onSave: () => void; onNotice: (message: string) => void;
}) {
  return <div className="builder-layout">
    <section className="content-panel player-panel">
      <div className="panel-heading builder-title"><div><span className="panel-overline">THE TRANSFER MARKET</span><h3>Every great crew starts somewhere.</h3></div><span className="market-count">{athletes.length} ROWERS</span></div>
      <div className="builder-controls"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rowers or schools" /></label><label className="filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter school" value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}><option>All schools</option>{schoolNames.map((school) => <option key={school}>{school}</option>)}</select><ChevronDown size={14} /></label><label className="sort-select"><select aria-label="Sort athletes" value={sortBy} onChange={(event) => setSortBy(event.target.value as "points" | "price" | "rank")}><option value="points">Sort: points</option><option value="rank">Sort: ranking</option><option value="price">Sort: value</option></select><ChevronDown size={14} /></label></div>
      <div className="market-filter-grid"><label className="compact-filter"><span>YEAR GROUP</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option>Any year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label><label className="compact-filter"><span>BOAT CLASS</span><select value={boatFilter} onChange={(event) => setBoatFilter(event.target.value)}><option>Any boat</option>{boats.map((boat) => <option key={boat}>{boat}</option>)}</select></label><label className="compact-filter"><span>NATIONAL RANK</span><select value={rankFilter} onChange={(event) => setRankFilter(event.target.value)}><option value="any">Any rank</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="20">Top 20</option></select></label><label className="compact-filter"><span>SEASON POINTS</span><select value={pointsFilter} onChange={(event) => setPointsFilter(event.target.value)}><option value="any">Any points</option><option value="100">100+ points</option><option value="125">125+ points</option><option value="150">150+ points</option></select></label><label className="compact-filter"><span>2K ERG</span><select value={ergFilter} onChange={(event) => setErgFilter(event.target.value)}><option value="any">Any score</option><option value="380">Under 6:20</option><option value="390">Under 6:30</option><option value="405">Under 6:45</option></select></label></div>
      <div className="market-table"><div className="market-head"><span>ROWER</span><span>ERG</span><span>RANK</span><span>POINTS</span><span>VALUE</span><span /></div>
        {athletes.length === 0 ? <div className="empty-results">No rowers match those filters. Try another school or search.</div> : athletes.map((athlete) => {
          const inTeam = selected.includes(athlete.id);
          const isOverBudget = !inTeam && selected.length < 8 && spend + athlete.price > BUDGET;
          return <div className={`market-row${inTeam ? " market-row-selected" : ""}`} key={athlete.id}><Link className="market-athlete market-athlete-link" href={`/athletes/${athlete.id}`}><i className="athlete-avatar" style={{ "--avatar": athlete.color } as React.CSSProperties}>{athlete.initials}</i><span><strong>{athlete.name}</strong><small>{athlete.school} <i /> {athlete.year}</small></span></Link><span className="market-erg">{athlete.erg}</span><span className="market-rank">#{athlete.rank}</span><span className="market-points">{athlete.points}</span><span className="market-price">£{athlete.price.toFixed(1)}<small>m</small></span><button className={`add-player${inTeam ? " player-added" : ""}`} onClick={() => onToggle(athlete)} disabled={isOverBudget} title={inTeam ? "Remove from crew" : isOverBudget ? "Not enough budget remaining" : "Add to crew"} aria-label={inTeam ? `Remove ${athlete.name}` : `Add ${athlete.name}`}>{inTeam ? <Check size={16} /> : <Plus size={16} />}</button></div>;
        })}
      </div>
      <div className="market-foot"><span>PRICES REFLECT CURRENT SEASON FORM</span><span>SCROLL TO EXPLORE THE FIELD</span></div>
    </section>

    <aside className="squad-summary">
      <div className="summary-head"><div><span className="panel-overline">YOUR SELECTION</span><h3>The eight.</h3></div><span className="slot-count">{selected.length}<small> / 8</small></span></div>
      <label className="team-name-field"><span>CREW NAME</span><input maxLength={40} value={teamName} onChange={(event) => setTeamName(event.target.value)} aria-label="Crew name" /></label>
      <div className="budget-block"><div className="budget-label"><span>REMAINING BUDGET</span><strong>£{remaining.toFixed(1)}m</strong></div><div className="budget-track"><span style={{ width: `${Math.max(0, Math.min(100, (spend / BUDGET) * 100))}%` }} /></div><div className="budget-numbers"><span>£{spend.toFixed(1)}m spent</span><span>£100.0m</span></div></div>
      <div className="crew-slots">{Array.from({ length: 8 }, (_, index) => {
        const athlete = selectedAthletes[index];
        return <div className={`crew-slot${athlete ? " filled-slot" : ""}`} key={index}><span className="slot-no">{String(index + 1).padStart(2, "0")}</span>{athlete ? <><i className="athlete-avatar slot-avatar" style={{ "--avatar": athlete.color } as React.CSSProperties}>{athlete.initials}</i><span className="slot-athlete"><strong>{athlete.name}</strong><small>{athlete.school}</small></span><span className="slot-price">£{athlete.price.toFixed(1)}m</span><button className={`captain-button${captain === athlete.id ? " captain-selected" : ""}`} onClick={() => onCaptain(athlete.id)} aria-label={`Make ${athlete.name} captain`} title={captain === athlete.id ? "Captain" : "Set captain"}><Crown size={15} /></button></> : <><span className="empty-seat"><Plus size={13} /></span><span className="empty-seat-label">Open seat</span><span className="empty-seat-hint">Pick a rower</span></>}</div>;
      })}</div>
      <div className="captain-hint"><Crown size={14} /><span>Choose a captain. Their race points count double.</span></div>
      <button className="save-team-button" onClick={onSave} disabled={saved && selected.length === 8}>{saved ? <><Check size={17} /> Crew saved</> : <>Save your crew <ArrowRight size={16} /></>}</button>
      <button className="reset-team-button" onClick={() => { if (!selected.length) { onNotice("Your crew is already empty."); return; } onNotice("Remove rowers one at a time using the check buttons."); }}>Transfers close at race start <Clock3 size={13} /></button>
    </aside>
  </div>;
}

function LeagueView({ onBuild }: { onBuild: () => void }) {
  return <div className="league-page-grid"><section className="content-panel full-league-panel"><div className="panel-heading"><div><span className="panel-overline">GLOBAL · 2,418 MANAGERS</span><h3>Overall standings</h3></div><button className="filter-select league-period"><Clock3 size={14} /><span>Season to date</span><ChevronDown size={14} /></button></div><div className="league-table"><div className="league-table-head"><span>POS</span><span>MANAGER</span><span>TEAM NAME</span><span>POINTS</span><span>GW</span></div>{["Hammersmith Hero", "Eight Bells", "Bow Ball Champion", "The Coxless Crew", "Sons of the Thames", "Paddle Faster"].map((team, index) => <div className={`league-row${index === 0 ? " league-first" : ""}`} key={team}><span className="league-position">{String(index + 1).padStart(2, "0")}{index < 3 && <Trophy size={13} />}</span><span className="league-manager"><i>{["AM", "JK", "LT", "SC", "EW", "RB"][index]}</i><strong>{["Alex Morgan", "James Knight", "Lucy Taylor", "Sam Carter", "Emily White", "Ryan Brooks"][index]}</strong></span><span className="league-team-name">{team}</span><strong className="league-points">{(248 + index * -17).toLocaleString("en-GB")}</strong><span className="league-gameweek">{42 - index * 3}</span></div>)}</div><div className="league-foot"><span>YOUR POSITION APPEARS WHEN YOUR FIRST CREW IS SAVED</span><button onClick={onBuild}>Build your crew <ArrowRight size={14} /></button></div></section><aside className="league-side"><div className="league-promo"><span className="panel-overline">YOUR PEOPLE, YOUR TABLE</span><h3>It&apos;s better<br />with a little<br /><em>competition.</em></h3><p>Start a private league for your school, squad or group chat.</p><button onClick={onBuild}>Start a league <ArrowRight size={15} /></button><span className="league-promo-mark"><Trophy size={44} /></span></div><div className="school-mini"><span className="panel-overline">SCHOOL STANDINGS</span><h3>Your school, in the mix.</h3><p>Fantasy points are calculated from your athletes&apos; real race results. The more points your rowers earn, the higher your school climbs.</p><button onClick={onBuild}>Pick your crew <ArrowRight size={15} /></button></div></aside></div>;

function CalendarView() {
  const otherRaces = [
    { day: "—", month: "TBC", title: "Henley Royal Regatta", place: "Henley-on-Thames", type: "REGATTA", color: "blue" },
    { day: "—", month: "TBC", title: "Henley Women's Regatta", place: "Henley-on-Thames", type: "REGATTA", color: "gold" },
    { day: "—", month: "TBC", title: "Junior Sculling Head", place: "Dorney Lake, Eton", type: "HEAD RACE", color: "red" },
    { day: "—", month: "TBC", title: "Quintin Head", place: "River Thames, London", type: "HEAD RACE", color: "blue" },
  ];

  return <div className="calendar-page"><div className="calendar-intro"><div><span className="panel-overline">2026 / 27 RACING SEASON · DATES TO FOLLOW</span><h3>Mark the good days.</h3><p>Seven fixtures. One season. Follow every start from the first head race to the final Henley reach.</p></div><div className="calendar-count"><strong>07</strong><span>REGATTAS<br />THIS SEASON</span></div></div><div className="calendar-month"><span>THE SEASON AHEAD</span><i /></div><div className="calendar-events">{races.map((race) => <RaceRow key={race.title} race={race} />)}{otherRaces.map((race) => <RaceRow key={race.title} race={race} />)}</div><div className="calendar-note"><Sparkles size={17} /><span><strong>School fixtures are welcome here.</strong> Admins can add school events as the season schedule is confirmed.</span></div></div>;
}