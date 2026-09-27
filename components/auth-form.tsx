"use client";

import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail, Waves } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type AuthFormProps = { mode: "sign-in" | "sign-up"; next: string; initialError?: string };

export default function AuthForm({ mode, next, initialError = "" }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "sign-up";
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setBusy(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Account access is not configured yet. Add your Supabase URL and anon key to enable registration and login.");
      setBusy(false); return;
    }

    const supabase = createBrowserClient(url, key);
    if (isSignUp) {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callback.toString() },
      });
      if (authError) setError(authError.message);
      else if (data.session) window.location.assign(next);
      else setMessage("Account created. Check your email to confirm your address, then you can sign in.");
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message);
      else window.location.assign(next);
    }
    setBusy(false);
  }

  const destination = `${isSignUp ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`;

  return <main className="signin-shell">
    <div className="signin-river" aria-hidden="true"><i /><i /><i /><i /></div>
    <section className="signin-panel">
      <Link className="signin-back" href="/"><ArrowLeft size={15} /> Back to the season</Link>
      <Link className="signin-brand" href="/"><span><Waves size={22} /></span>fantasy<span>rowing</span></Link>
      <span className="signin-overline">{isSignUp ? "YOUR PLACE IN THE CREW" : "YOUR CREW, WHEREVER YOU ARE"}</span>
      <h1>{isSignUp ? <>Start your<br />season here.</> : <>Back on<br />the water.</>}</h1>
      <p>{isSignUp ? "Create your manager account to pick a crew and follow the season." : "Sign in to find your saved crew waiting at the start."}</p>
      <form onSubmit={submit}>
        <label htmlFor="account-email">EMAIL ADDRESS</label>
        <div className="signin-email"><Mail size={16} /><input id="account-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <label htmlFor="account-password">PASSWORD</label>
        <div className="signin-email"><LockKeyhole size={16} /><input id="account-password" type="password" required minLength={8} autoComplete={isSignUp ? "new-password" : "current-password"} placeholder={isSignUp ? "At least 8 characters" : "Your password"} value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <button disabled={busy}>{busy ? "Please wait…" : <>{isSignUp ? "Create my account" : "Sign in"} <ArrowRight size={15} /></>}</button>
      </form>
      {message && <div className="signin-message"><Check size={16} />{message}</div>}
      {!authConfigured && <div className="auth-config-warning" role="status">Account creation is not enabled yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart the dev server.</div>}
      {error && <div className="signin-error" role="alert">{error}</div>}
      <div className="auth-switch">{isSignUp ? "Already have an account?" : "New to Fantasy Rowing?"} <Link href={destination}>{isSignUp ? "Sign in" : "Create an account"}</Link></div>
      <div className="signin-foot">ONE ACCOUNT. EVERY RACE DAY.</div>
    </section>
  </main>;
}