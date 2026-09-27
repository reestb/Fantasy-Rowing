create table if not exists public.private_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40),
  invite_code text not null unique,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.private_league_members (
  league_id uuid not null references public.private_leagues (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table public.private_leagues enable row level security;
alter table public.private_league_members enable row level security;
grant usage on schema public to authenticated;
grant select on public.private_leagues, public.private_league_members to authenticated;

create or replace function public.create_private_league(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  manager_id uuid := auth.uid();
  league_id uuid;
  code text;
  clean_name text := trim(coalesce(p_name, ''));
begin
  if manager_id is null then raise exception 'Sign in to create a private league.'; end if;
  if char_length(clean_name) not between 3 and 40 then
    raise exception 'League name must be between 3 and 40 characters.';
  end if;

  loop
    code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));
    exit when not exists (select 1 from public.private_leagues where invite_code = code);
  end loop;

  insert into public.private_leagues (name, invite_code, owner_user_id)
  values (clean_name, code, manager_id)
  returning id into league_id;

  insert into public.private_league_members (league_id, user_id)
  values (league_id, manager_id);

  return jsonb_build_object('id', league_id, 'name', clean_name, 'invite_code', code);
end;
$$;

create or replace function public.join_private_league(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  manager_id uuid := auth.uid();
  found_league public.private_leagues%rowtype;
begin
  if manager_id is null then raise exception 'Sign in to join a private league.'; end if;

  select * into found_league
  from public.private_leagues
  where invite_code = upper(trim(coalesce(p_invite_code, '')));
  if not found then raise exception 'That invite code was not found.'; end if;

  insert into public.private_league_members (league_id, user_id)
  values (found_league.id, manager_id)
  on conflict (league_id, user_id) do nothing;

  return jsonb_build_object('id', found_league.id, 'name', found_league.name, 'invite_code', found_league.invite_code);
end;
$$;

create or replace function public.get_my_private_leagues()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', league.id,
      'name', league.name,
      'invite_code', league.invite_code,
      'is_owner', league.owner_user_id = auth.uid(),
      'members', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'user_id', member.user_id,
            'display_name', member.display_name,
            'team_name', member.team_name,
            'total_points', member.total_points
          ) order by member.total_points desc, member.display_name asc
        ), '[]'::jsonb)
        from (
          select
            membership.user_id,
            coalesce(manager.display_name, 'Manager') as display_name,
            team.name as team_name,
            coalesce((
              select sum(result.fantasy_points * case when selection.is_captain then 2 else 1 end)::integer
              from public.team_athletes as selection
              join public.results as result on result.athlete_id = selection.athlete_id
              where selection.team_id = team.id
                and result.raced_at >= selection.selected_at
                and (selection.removed_at is null or result.raced_at <= selection.removed_at)
            ), 0) as total_points
          from public.private_league_members as membership
          join public.users as manager on manager.id = membership.user_id
          left join public.fantasy_teams as team on team.user_id = membership.user_id
          where membership.league_id = league.id
        ) as member
      )
    ) order by league.created_at desc
  ), '[]'::jsonb)
  from public.private_league_members as mine
  join public.private_leagues as league on league.id = mine.league_id
  where mine.user_id = auth.uid();
$$;

revoke all on function public.create_private_league(text) from public;
revoke all on function public.join_private_league(text) from public;
revoke all on function public.get_my_private_leagues() from public;
grant execute on function public.create_private_league(text) to authenticated;
grant execute on function public.join_private_league(text) to authenticated;
grant execute on function public.get_my_private_leagues() to authenticated;