drop policy if exists "Managers can update their own profile" on public.users;
create policy "Managers can update their own profile"
on public.users for update
using (auth.uid() = id and role = 'manager')
with check (auth.uid() = id and role = 'manager');

insert into public.users (id, display_name)
select
  account.id,
  coalesce(account.raw_user_meta_data ->> 'full_name', split_part(coalesce(account.email, 'rower'), '@', 1))
from auth.users as account
on conflict (id) do nothing;

create or replace function public.ensure_manager_profile()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.users (id, display_name)
  select
    account.id,
    coalesce(account.raw_user_meta_data ->> 'full_name', split_part(coalesce(account.email, 'rower'), '@', 1))
  from auth.users as account
  where account.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_manager_profile() from public;
grant execute on function public.ensure_manager_profile() to authenticated;

create or replace function public.get_manager_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with team_totals as (
    select
      team.id as team_id,
      team.user_id,
      team.name as team_name,
      team.best_finish,
      team.team_value,
      coalesce(sum(result.fantasy_points * case when membership.is_captain then 2 else 1 end), 0)::integer as total_points
    from public.fantasy_teams as team
    left join public.team_athletes as membership on membership.team_id = team.id
    left join public.results as result
      on result.athlete_id = membership.athlete_id
      and result.raced_at >= membership.selected_at
      and (membership.removed_at is null or result.raced_at <= membership.removed_at)
    group by team.id
  ), ranked_teams as (
    select
      team_totals.*,
      rank() over (order by total_points desc) as overall_rank
    from team_totals
  )
  select jsonb_build_object(
    'display_name', manager.display_name,
    'supported_school_id', manager.supported_school_id,
    'supported_school_name', school.name,
    'team_id', team.team_id,
    'team_name', team.team_name,
    'total_points', coalesce(team.total_points, 0),
    'overall_rank', team.overall_rank,
    'best_finish', team.best_finish,
    'team_value', team.team_value
  )
  from public.users as manager
  left join public.schools as school on school.id = manager.supported_school_id
  left join ranked_teams as team on team.user_id = manager.id
  where manager.id = auth.uid();
$$;

revoke all on function public.get_manager_dashboard() from public;
grant execute on function public.get_manager_dashboard() to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.schools, public.school_boats, public.athletes, public.regattas, public.results, public.leaderboards, public.erg_history to anon, authenticated;
grant select on public.users, public.fantasy_teams, public.team_athletes, public.transfers, public.fantasy_team_totals to authenticated;
grant update on public.users to authenticated;
grant all privileges on public.schools, public.athletes, public.regattas, public.results to service_role;

create table if not exists public.school_boats (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  event_category text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

alter table public.athletes add column if not exists school_boat_id uuid references public.school_boats (id) on delete set null;
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

alter table public.school_boats enable row level security;
drop policy if exists "School boats are visible to everyone" on public.school_boats;
create policy "School boats are visible to everyone" on public.school_boats for select using (true);
drop policy if exists "Admins manage school boats" on public.school_boats;
create policy "Admins manage school boats" on public.school_boats for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);
grant select on public.school_boats to anon, authenticated;
grant all privileges on public.school_boats to service_role;

-- Normalized school names from https://regatta.time-team.nl/nsr/2026/entries/clubs.php.
-- Admins can add UK school rowing programs that do not appear in that year's entries.
insert into public.schools (name) values
  ('Abingdon School'),
  ('Aberdeen Schools Rowing Association'),
  ('American School in London'),
  ('Bedford Girls'' School'),
  ('Bedford Modern School'),
  ('Bedford School'),
  ('Bradford Grammar School'),
  ('Bryanston School'),
  ('Canford School'),
  ('Claires Court School'),
  ('Cheltenham College'),
  ('Doncaster Schools'' Rowing Association'),
  ('Dulwich College'),
  ('Durham School'),
  ('Emanuel School'),
  ('Eton College'),
  ('Glasgow Academy'),
  ('George Heriot''s School'),
  ('Godolphin and Latymer School'),
  ('Great Marlow School'),
  ('The Grange School'),
  ('Haberdashers Monmouth School'),
  ('Hampton School'),
  ('Headington School'),
  ('Hereford Cathedral School'),
  ('Ibstock Place School'),
  ('James Allen''s Girls'' School'),
  ('Kew House School'),
  ('King''s College School, Wimbledon'),
  ('Kingston Grammar School'),
  ('The King''s School, Canterbury'),
  ('The King''s School, Chester'),
  ('King''s Ely'),
  ('King''s Rochester'),
  ('The King''s School, Worcester'),
  ('Lady Eleanor Holles School'),
  ('Latymer Upper School'),
  ('The Leys School'),
  ('Magdalen College School'),
  ('Methodist College Belfast'),
  ('Millfield School'),
  ('Monkton Combe School'),
  ('Monmouth Comprehensive School'),
  ('Norwich High School'),
  ('Norwich School'),
  ('The Oratory School'),
  ('Oundle School'),
  ('Pangbourne College'),
  ('Putney High School'),
  ('Queen Elizabeth High School'),
  ('Radley College'),
  ('Radnor House School'),
  ('Reading Blue Coat School'),
  ('Royal Grammar School, High Wycombe'),
  ('Shiplake College'),
  ('Shrewsbury School'),
  ('Sir William Borlase''s Grammar School'),
  ('Sir William Perkins''s School'),
  ('St Edward''s School'),
  ('St George''s College, Weybridge'),
  ('St Mary''s School, Cambridge'),
  ('St Peter''s School, York'),
  ('St Paul''s Girls'' School'),
  ('St Paul''s School'),
  ('Stowe School'),
  ('Streatham and Clapham High School'),
  ('Surbiton High School'),
  ('Sydenham High School'),
  ('Tiffin School'),
  ('Tormead School'),
  ('The Windsor Boys'' School'),
  ('Westminster School'),
  ('Wimbledon High School'),
  ('Winchester College'),
  ('Windsor Girls'' School'),
  ('Wycliffe College'),
  ('Yarm School')
on conflict (name) do nothing;