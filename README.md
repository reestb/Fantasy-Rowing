# Fantasy Rowing

A mobile-first fantasy rowing app for the UK junior school season, built with Next.js, React, TypeScript, Tailwind CSS and Supabase.

## Run locally

Requirements: Node.js 20.9 or later and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Before starting the app, fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` from your Supabase project. Restart the dev server after changing them. Open [http://localhost:3000](http://localhost:3000); visitors must create an account or sign in before the season dashboard is available. Email confirmation behavior follows the Supabase project's Auth settings.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
3. Run [`supabase/personalization.sql`](supabase/personalization.sql) in the SQL Editor to enable editable manager profiles, personalized crew stats, seed schools that entered the 2026 National Schools Regatta, and register school boats from athlete school/boat-class assignments. The seed is safe to rerun; admins can add other UK school rowing programs from the admin desk.
4. Copy the project URL and anon key from **Project Settings → API** into `.env.local`. For admin writes, also add the server-only `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`. Enable email/password authentication and configure the site's `/auth/callback` URL in Supabase Auth redirect settings.
5. Set `ADMIN_ACCESS_CODE` (default `12481248`) to choose the code required to open `/admin`.
6. Add schools and rowers in the admin desk, then enter results after each race. Result points and athlete season totals are calculated by database triggers.

The service-role/secret key and admin access code are server-only secrets. Never expose either with a `NEXT_PUBLIC_` prefix or commit `.env.local`. Admin access is cleared when leaving or refreshing the admin page. Admin photo uploads create a public Supabase Storage bucket named `athlete-photos` on first use; only administrators can upload through the app.

### Scoring

Race win: 50 points; silver: 40; bronze: 30; 4th–10th: 15; course record: +25; crew of the week: +20. Captain doubling is applied to a selected team's result total, not the athlete's shared base score.

## Deploy to Vercel

1. Push this repository to GitHub and import it into Vercel as a Next.js project.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) and `ADMIN_ACCESS_CODE` under **Project Settings → Environment Variables** for the environments you use.
3. Redeploy after setting the variables. Vercel uses `npm run build` automatically.
4. Apply database changes through the Supabase SQL Editor (or your normal migration workflow); Vercel does not run `schema.sql` for you.

## Routes

- `/` — season dashboard, athlete rankings, fixture calendar, league tables and the budgeted eight-rower crew builder.
- `/sign-up` — first-time account registration.
- `/sign-in` — returning-user email/password login.
- `/account` — edit display name, supported school and view saved team stats.
- `/athletes/[id]` — rowing profile, race/erg histories and upcoming fixtures.
- `/admin` — protected athlete, school, photo, individual-result and school-boat-result management. Boat results award points to every active athlete assigned to the selected school boat.
- `/api/team` — authenticated team load/save.
- `/api/admin/athletes` — create, update and archive athletes.
- `/api/admin/schools` — create schools.
- `/api/admin/results` — enter scored race results.
- `/api/admin/upload` — upload athlete photos to Supabase Storage.

The initial leaderboard and featured race editorial values are presentation fixtures. Athlete reads switch to Supabase when configured. Managers can sign in with a Supabase email link; crew saves are validated atomically in Postgres against the eight-rower and £100m rules, with transfer and captain history retained for team scoring.