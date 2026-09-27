create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Rowing fan',
  supported_school_id uuid,
  role text not null default 'manager' check (role in ('manager', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.create_manager_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'rower'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.create_manager_profile();

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  squad_size integer not null default 0 check (squad_size >= 0),
  head_coach text,
  school_colour text not null default '#1f4b70',
  current_ranking integer,
  total_fantasy_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.school_boats (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  event_category text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

alter table public.users drop constraint if exists users_supported_school_id_fkey;
alter table public.users add constraint users_supported_school_id_fkey
  foreign key (supported_school_id) references public.schools (id) on delete set null;

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  school_id uuid references public.schools (id) on delete set null,
  school_boat_id uuid references public.school_boats (id) on delete set null,
  year_group integer check (year_group between 7 and 14),
  age integer check (age between 12 and 19),
  event_category text,
  boat_class text,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  erg_score text,
  national_ranking integer,
  photo_url text,
  bio text,
  fantasy_value numeric(5, 1) not null default 5.0 check (fantasy_value >= 0),
  season_points integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athletes_school_boat_id_idx on public.athletes (school_boat_id);

insert into public.school_boats (school_id, name)
select distinct school_id, btrim(boat_class)
from public.athletes
where school_id is not null and nullif(btrim(boat_class), '') is not null
on conflict (school_id, name) do nothing;

update public.athletes as athlete
set school_boat_id = boat.id
from public.school_boats as boat
where athlete.school_id = boat.school_id
  and btrim(athlete.boat_class) = boat.name
  and athlete.school_boat_id is distinct from boat.id;

create table if not exists public.regattas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  event_category text,
  is_admin_event boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  regatta_id uuid not null references public.regattas (id) on delete cascade,
  position integer check (position > 0),
  event text not null,
  time text,
  course_record boolean not null default false,
  crew_of_the_week boolean not null default false,
  fantasy_points integer not null default 0,
  raced_at timestamptz not null default now(),
  entered_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.score_race_result()
returns trigger language plpgsql as $$
begin
  new.fantasy_points := case new.position
    when 1 then 50
    when 2 then 40
    when 3 then 30
    else case when new.position between 4 and 10 then 15 else 0 end
  end;
  if new.course_record then new.fantasy_points := new.fantasy_points + 25; end if;
  if new.crew_of_the_week then new.fantasy_points := new.fantasy_points + 20; end if;
  return new;
end;
$$;

drop trigger if exists results_score_before_insert on public.results;
create trigger results_score_before_insert
before insert or update
on public.results for each row execute function public.score_race_result();

create or replace function public.add_result_to_athlete_points()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.athletes
    set season_points = season_points + new.fantasy_points, updated_at = now()
    where id = new.athlete_id;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.athlete_id = new.athlete_id then
      update public.athletes
      set season_points = greatest(0, season_points + new.fantasy_points - old.fantasy_points), updated_at = now()
      where id = new.athlete_id;
    else
      update public.athletes
      set season_points = greatest(0, season_points - old.fantasy_points), updated_at = now()
      where id = old.athlete_id;
      update public.athletes
      set season_points = season_points + new.fantasy_points, updated_at = now()
      where id = new.athlete_id;
    end if;
    return new;
  else
    update public.athletes
    set season_points = greatest(0, season_points - old.fantasy_points), updated_at = now()
    where id = old.athlete_id;
    return old;
  end if;
end;
$$;

drop trigger if exists results_update_athlete_points on public.results;
create trigger results_update_athlete_points
after insert or update or delete on public.results for each row execute function public.add_result_to_athlete_points();

create table if not exists public.fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  name text not null default 'My Crew',
  budget numeric(6, 1) not null default 100.0,
  team_value numeric(6, 1) not null default 0,
  total_points integer not null default 0,
  best_finish integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_athletes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fantasy_teams (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  is_captain boolean not null default false,
  purchased_at numeric(5, 1) not null,
  selected_at timestamptz not null default now(),
  removed_at timestamptz
);
create unique index if not exists one_active_athlete_per_fantasy_team
  on public.team_athletes (team_id, athlete_id) where removed_at is null;
create unique index if not exists one_captain_per_fantasy_team
  on public.team_athletes (team_id) where is_captain and removed_at is null;

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fantasy_teams (id) on delete cascade,
  athlete_out_id uuid references public.athletes (id) on delete set null,
  athlete_in_id uuid references public.athletes (id) on delete set null,
  transferred_at timestamptz not null default now(),
  gameweek integer
);

create or replace function public.save_fantasy_team(
  p_team_name text,
  p_athlete_ids uuid[],
  p_captain_id uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  manager_id uuid := auth.uid();
  saved_team_id uuid;
  active_count integer;
  squad_value numeric(6, 1);
  previous_ids uuid[];
begin
  if manager_id is null then raise exception 'Sign in before saving a crew.'; end if;
  if cardinality(p_athlete_ids) <> 8
     or (select count(distinct athlete_id) from unnest(p_athlete_ids) as ids(athlete_id)) <> 8 then
    raise exception 'A crew must contain eight different rowers.';
  end if;
  if p_captain_id is null or not (p_captain_id = any(p_athlete_ids)) then
    raise exception 'Choose one rower in your crew as captain.';
  end if;

  select count(*), coalesce(sum(fantasy_value), 0)
  into active_count, squad_value
  from public.athletes
  where id = any(p_athlete_ids) and is_active;
  if active_count <> 8 then raise exception 'One or more selected rowers are no longer available.'; end if;
  if squad_value > 100 then raise exception 'Your crew is over the £100m budget.'; end if;

  insert into public.fantasy_teams (user_id, name, budget, team_value)
  values (manager_id, coalesce(nullif(trim(p_team_name), ''), 'My Crew'), 100, squad_value)
  on conflict (user_id) do update
  set name = excluded.name, budget = 100, team_value = excluded.team_value, updated_at = now()
  returning id into saved_team_id;

  select coalesce(array_agg(athlete_id), array[]::uuid[]) into previous_ids
  from public.team_athletes where team_id = saved_team_id and removed_at is null;

  if cardinality(previous_ids) > 0 then
    insert into public.transfers (team_id, athlete_out_id)
    select saved_team_id, old_id from unnest(previous_ids) as prior(old_id)
    where old_id <> all(p_athlete_ids);
    insert into public.transfers (team_id, athlete_in_id)
    select saved_team_id, new_id from unnest(p_athlete_ids) as incoming(new_id)
    where new_id <> all(previous_ids);
  end if;

  update public.team_athletes
  set removed_at = now()
  where team_id = saved_team_id and removed_at is null
    and (athlete_id <> all(p_athlete_ids) or is_captain <> (athlete_id = p_captain_id));

  insert into public.team_athletes (team_id, athlete_id, is_captain, purchased_at)
  select saved_team_id, athlete.id, athlete.id = p_captain_id, athlete.fantasy_value
  from public.athletes as athlete
  where athlete.id = any(p_athlete_ids)
    and not exists (
      select 1 from public.team_athletes as current_pick
      where current_pick.team_id = saved_team_id
        and current_pick.athlete_id = athlete.id
        and current_pick.is_captain = (athlete.id = p_captain_id)
        and current_pick.removed_at is null
    );

  return saved_team_id;
end;
$$;

grant execute on function public.save_fantasy_team(text, uuid[], uuid) to authenticated;

create or replace view public.fantasy_team_totals with (security_invoker = true) as
select
  team.id as team_id,
  team.user_id,
  team.name,
  coalesce(sum(result.fantasy_points * case when membership.is_captain then 2 else 1 end), 0)::integer as total_points
from public.fantasy_teams as team
left join public.team_athletes as membership on membership.team_id = team.id
left join public.results as result
  on result.athlete_id = membership.athlete_id
  and result.raced_at >= membership.selected_at
  and (membership.removed_at is null or result.raced_at <= membership.removed_at)
group by team.id, team.user_id, team.name;

create table if not exists public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period in ('global', 'school', 'weekly', 'athlete')),
  period_key text not null default 'season',
  team_id uuid references public.fantasy_teams (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  athlete_id uuid references public.athletes (id) on delete cascade,
  rank integer not null,
  points integer not null default 0,
  calculated_at timestamptz not null default now()
);

create table if not exists public.erg_history (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  distance_m integer not null default 2000,
  score text not null,
  recorded_at date not null default current_date
);

insert into public.regattas (name, location, event_category) values
  ('Schools Head', 'River Thames, London', 'Head race'),
  ('National Schools Regatta', 'Dorney Lake, Eton', 'Regatta'),
  ('Marlow Regatta', 'Dorney Lake, Eton', 'Regatta'),
  ('Henley Royal Regatta', 'Henley-on-Thames', 'Regatta'),
  ('Henley Women''s Regatta', 'Henley-on-Thames', 'Regatta'),
  ('Junior Sculling Head', 'Dorney Lake, Eton', 'Head race'),
  ('Quintin Head', 'River Thames, London', 'Head race')
on conflict do nothing;

alter table public.schools enable row level security;
alter table public.school_boats enable row level security;
alter table public.athletes enable row level security;
alter table public.regattas enable row level security;
alter table public.results enable row level security;
alter table public.users enable row level security;
alter table public.fantasy_teams enable row level security;
alter table public.team_athletes enable row level security;
alter table public.transfers enable row level security;
alter table public.leaderboards enable row level security;
alter table public.erg_history enable row level security;

create policy "Schools are visible to everyone" on public.schools for select using (true);
create policy "School boats are visible to everyone" on public.school_boats for select using (true);
create policy "Active athletes are visible to everyone" on public.athletes for select using (is_active);
create policy "Regattas are visible to everyone" on public.regattas for select using (true);
create policy "Results are visible to everyone" on public.results for select using (true);
create policy "Users can read their own profile" on public.users for select using (auth.uid() = id);
create policy "Managers can read their own team" on public.fantasy_teams for select using (user_id = auth.uid());
create policy "Managers can read their team rowers" on public.team_athletes for select using (
  exists (select 1 from public.fantasy_teams t where t.id = team_id and t.user_id = auth.uid())
);
create policy "Managers can read their own transfers" on public.transfers for select using (
  exists (select 1 from public.fantasy_teams t where t.id = team_id and t.user_id = auth.uid())
);
create policy "Leaderboards are visible to everyone" on public.leaderboards for select using (true);
create policy "Erg history is visible to everyone" on public.erg_history for select using (true);

create policy "Admins manage schools" on public.schools for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);
create policy "Admins manage school boats" on public.school_boats for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);
create policy "Admins manage athletes" on public.athletes for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);
create policy "Admins manage regattas" on public.regattas for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);
create policy "Admins manage race results" on public.results for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

grant usage on schema public to anon, authenticated;
grant select on public.schools, public.school_boats, public.athletes, public.regattas, public.results, public.leaderboards, public.erg_history to anon, authenticated;
grant select on public.users, public.fantasy_teams, public.team_athletes, public.transfers, public.fantasy_team_totals to authenticated;
grant update on public.users to authenticated;
grant all privileges on public.schools, public.athletes, public.regattas, public.results to service_role;
grant all privileges on public.school_boats to service_role;

comment on table public.athletes is 'Junior rowing athlete directory; only server-side admin credentials may write athlete data.';
comment on table public.results is 'Race results are scored automatically; captain doubling is applied per fantasy team.';
comment on function public.save_fantasy_team(text, uuid[], uuid) is 'Atomically validates and saves a manager crew, preserving transfer and captain history.';