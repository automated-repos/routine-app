-- =====================================================================
-- Routine App - Supabase schema
-- شغّلي الملف ده مرة واحدة من: Supabase Dashboard > SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Profiles (بيانات المستخدم + الإعدادات)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null default 'مستخدم',
  avatar_emoji        text not null default '🌱',
  is_admin            boolean not null default false,
  stars               integer not null default 0,
  show_on_leaderboard boolean not null default true,
  -- إعدادات
  timezone            text not null default 'Africa/Cairo',
  prayer_mode         boolean not null default false,
  latitude            double precision,
  longitude           double precision,
  city_name           text,
  calc_method         text not null default 'Egyptian',
  madhab              text not null default 'shafi' check (madhab in ('shafi','hanafi')),
  inactivity_days     integer not null default 3 check (inactivity_days between 1 and 30),
  last_log_at         timestamptz,
  last_seen_challenges_at timestamptz,
  created_at          timestamptz not null default now()
);

-- تسجيل الدخول باسم مستخدم: الإيميل الداخلي = username@routine.local
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists gender text check (gender in ('male','female'));
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- إنشاء profile تلقائي لما حد يسجل
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, display_name, gender)
  values (new.id, v_username, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), v_username),
          case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 2) Habits (العادات / الأهداف)
-- ---------------------------------------------------------------------
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title          text not null check (char_length(title) between 1 and 80),
  icon           text not null default '✅',
  period         text not null default 'daily' check (period in ('daily','weekly','monthly')),
  target_count   integer not null default 1 check (target_count between 1 and 31),
  prayer_anchor  text check (prayer_anchor in ('fajr','sunrise','dhuhr','asr','maghrib','isha')),
  prayer_offset  text not null default 'after' check (prayer_offset in ('before','after')),
  preferred_time time,
  archived       boolean not null default false,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits(user_id) where not archived;

-- حد أقصى 30 عادة نشطة لكل مستخدم (عشان محدش يجمع نجوم بعادات وهمية)
create or replace function public.limit_habits()
returns trigger language plpgsql as $$
begin
  if not new.archived and (tg_op = 'INSERT' or old.archived)
     and (select count(*) from public.habits where user_id = new.user_id and not archived) >= 30 then
    raise exception 'الحد الأقصى 30 عادة نشطة';
  end if;
  return new;
end $$;
drop trigger if exists habits_limit on public.habits;
create trigger habits_limit before insert or update of archived on public.habits
  for each row execute function public.limit_habits();

-- ---------------------------------------------------------------------
-- 3) Habit logs (كل مرة المستخدم ينفذ العادة)
-- ---------------------------------------------------------------------
create table if not exists public.habit_logs (
  id           uuid primary key default gen_random_uuid(),
  habit_id     uuid not null references public.habits(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  log_date     date not null,
  period_start date not null,
  created_at   timestamptz not null default now()
);
create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, log_date);
create index if not exists habit_logs_habit_period_idx on public.habit_logs(habit_id, period_start);

-- ---------------------------------------------------------------------
-- 4) Stars ledger (سجل النجوم - كل نجمة وسببها)
-- ---------------------------------------------------------------------
create table if not exists public.stars_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  amount       integer not null,
  reason       text not null check (reason in ('completion','period_bonus','challenge','admin')),
  habit_id     uuid references public.habits(id) on delete set null,
  log_id       uuid references public.habit_logs(id) on delete cascade,
  challenge_id uuid,
  period_start date,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists stars_user_idx on public.stars_ledger(user_id, created_at);

-- تحديث رصيد النجوم في profiles تلقائياً
create or replace function public.sync_stars()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set stars = stars + new.amount where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set stars = stars - old.amount where id = old.user_id;
  end if;
  return null;
end $$;
drop trigger if exists stars_sync on public.stars_ledger;
create trigger stars_sync after insert or delete on public.stars_ledger
  for each row execute function public.sync_stars();

-- ---------------------------------------------------------------------
-- 5) Challenges (تحديات الأدمن)
-- ---------------------------------------------------------------------
create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  icon          text not null default '🏆',
  -- auto: بيتحسب من سجل العادات تلقائي | manual: المستخدم يطلب والأدمن يوافق
  kind          text not null default 'auto' check (kind in ('auto','manual')),
  habit_period  text check (habit_period in ('daily','weekly','monthly')), -- null = أي عادة
  target_count  integer not null default 10 check (target_count > 0),
  bonus_stars   integer not null default 10 check (bonus_stars between 0 and 1000),
  starts_on     date not null default current_date,
  ends_on       date not null,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  check (ends_on >= starts_on)
);

alter table public.stars_ledger drop constraint if exists stars_ledger_challenge_fk;
alter table public.stars_ledger add constraint stars_ledger_challenge_fk
  foreign key (challenge_id) references public.challenges(id) on delete set null;

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'joined' check (status in ('joined','pending','completed','rejected')),
  joined_at    timestamptz not null default now(),
  completed_at timestamptz,
  primary key (challenge_id, user_id)
);

-- ---------------------------------------------------------------------
-- 6) Helpers
-- ---------------------------------------------------------------------
-- تاريخ النهارده حسب توقيت المستخدم
create or replace function public.user_today(p_user uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_user), 'Africa/Cairo'))::date;
$$;

-- بداية الفترة: يومي = اليوم، أسبوعي = السبت، شهري = أول الشهر
create or replace function public.period_start(p_period text, d date)
returns date language sql immutable as $$
  select case p_period
    when 'daily'   then d
    when 'weekly'  then d - ((extract(dow from d)::int + 1) % 7)
    when 'monthly' then date_trunc('month', d)::date
  end;
$$;

create or replace function public.period_bonus(p_period text)
returns integer language sql immutable as $$
  select case p_period when 'daily' then 1 when 'weekly' then 3 when 'monthly' then 10 end;
$$;

-- ---------------------------------------------------------------------
-- 7) RPC: تسجيل تنفيذ عادة (النجوم بتتحسب هنا على السيرفر)
-- ---------------------------------------------------------------------
create or replace function public.log_habit(p_habit_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_habit public.habits%rowtype;
  v_today date;
  v_start date;
  v_count integer;
  v_log   uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_habit from public.habits where id = p_habit_id and user_id = v_uid and not archived;
  if not found then raise exception 'العادة غير موجودة'; end if;

  v_today := public.user_today(v_uid);
  v_start := public.period_start(v_habit.period, v_today);

  -- قفل عشان الضغط المتكرر بسرعة ميعديش الهدف
  perform pg_advisory_xact_lock(hashtext(p_habit_id::text || v_start::text));

  select count(*) into v_count from public.habit_logs
   where habit_id = p_habit_id and period_start = v_start;

  if v_count >= v_habit.target_count then
    return json_build_object('ok', false, 'count', v_count, 'message', 'الهدف متحقق بالفعل للفترة دي');
  end if;

  insert into public.habit_logs (habit_id, user_id, log_date, period_start)
  values (p_habit_id, v_uid, v_today, v_start) returning id into v_log;

  -- حد أقصى 50 نجمة تنفيذ في اليوم (التسجيل بيتم عادي بس من غير نجمة زيادة)
  if (select count(*) from public.habit_logs where user_id = v_uid and log_date = v_today) <= 50 then
    insert into public.stars_ledger (user_id, amount, reason, habit_id, log_id, period_start)
    values (v_uid, 1, 'completion', p_habit_id, v_log, v_start);
  end if;

  v_count := v_count + 1;
  if v_count = v_habit.target_count then
    insert into public.stars_ledger (user_id, amount, reason, habit_id, period_start)
    values (v_uid, public.period_bonus(v_habit.period), 'period_bonus', p_habit_id, v_start);
  end if;

  update public.profiles set last_log_at = now() where id = v_uid;

  return json_build_object('ok', true, 'count', v_count, 'completed', v_count = v_habit.target_count);
end $$;

-- RPC: التراجع عن آخر تنفيذ في الفترة الحالية
create or replace function public.unlog_habit(p_habit_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_habit public.habits%rowtype;
  v_start date;
  v_log   uuid;
  v_count integer;
begin
  select * into v_habit from public.habits where id = p_habit_id and user_id = v_uid;
  if not found then raise exception 'العادة غير موجودة'; end if;

  v_start := public.period_start(v_habit.period, public.user_today(v_uid));
  perform pg_advisory_xact_lock(hashtext(p_habit_id::text || v_start::text));

  select id into v_log from public.habit_logs
   where habit_id = p_habit_id and period_start = v_start
   order by created_at desc limit 1;
  if v_log is null then return json_build_object('ok', false, 'count', 0); end if;

  delete from public.habit_logs where id = v_log; -- نجمة التنفيذ بتتمسح معاه (cascade)

  -- لو الهدف بقى مش متحقق، نشيل البونص
  delete from public.stars_ledger
   where user_id = v_uid and habit_id = p_habit_id and reason = 'period_bonus' and period_start = v_start;

  select count(*) into v_count from public.habit_logs where habit_id = p_habit_id and period_start = v_start;
  return json_build_object('ok', true, 'count', v_count);
end $$;

-- RPC: عدد الإنجازات في كل يوم (للـ streak وخريطة النشاط)
create or replace function public.my_activity(p_from date)
returns table (log_date date, n bigint)
language sql stable set search_path = public as $$
  select log_date, count(*) from public.habit_logs
   where user_id = auth.uid() and log_date >= p_from
   group by log_date;
$$;

-- ---------------------------------------------------------------------
-- 8) RPC: قوائم الشرف
--   p_period: 'daily' | 'weekly' | 'monthly' | 'stars'
--   p_range : 'week' | 'month' | 'all'
-- ---------------------------------------------------------------------
create or replace function public.get_leaderboard(p_period text, p_range text default 'month')
returns table (user_id uuid, display_name text, avatar_emoji text, score bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_from  date := case p_range
                    when 'week'  then public.period_start('weekly', v_today)
                    when 'month' then public.period_start('monthly', v_today)
                    else date '2000-01-01' end;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  if p_period = 'stars' then
    return query
      select p.id, p.display_name, p.avatar_emoji, sum(s.amount)::bigint as score
        from public.stars_ledger s join public.profiles p on p.id = s.user_id
       where p.show_on_leaderboard and s.created_at >= v_from
       group by p.id
      having sum(s.amount) > 0
       order by score desc, p.display_name
       limit 50;
  else
    return query
      with met as (
        select l.user_id, l.habit_id, l.period_start
          from public.habit_logs l join public.habits h on h.id = l.habit_id
         where h.period = p_period and l.period_start >= v_from
         group by l.user_id, l.habit_id, l.period_start, h.target_count
        having count(*) >= h.target_count
      )
      select p.id, p.display_name, p.avatar_emoji, count(*)::bigint as score
        from met join public.profiles p on p.id = met.user_id
       where p.show_on_leaderboard
       group by p.id
       order by score desc, p.display_name
       limit 50;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9) RPC: التحديات
-- ---------------------------------------------------------------------
-- تقدم المستخدم في تحدي (عدد مرات التنفيذ خلال فترة التحدي)
create or replace function public.challenge_progress(p_challenge_id uuid, p_user uuid default auth.uid())
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.habit_logs l
    join public.habits h on h.id = l.habit_id
    join public.challenges c on c.id = p_challenge_id
   where l.user_id = p_user
     and (p_user = auth.uid() or public.is_admin())
     and l.log_date between c.starts_on and c.ends_on
     and (c.habit_period is null or h.period = c.habit_period);
$$;

create or replace function public.join_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.challenges where id = p_challenge_id
                 and ends_on >= public.user_today(auth.uid())) then
    raise exception 'التحدي منتهي';
  end if;
  insert into public.challenge_participants (challenge_id, user_id)
  values (p_challenge_id, auth.uid()) on conflict do nothing;
end $$;

-- طلب البونص: التلقائي بيتصرف فوراً لو الهدف متحقق، اليدوي بيروح للأدمن
create or replace function public.claim_challenge(p_challenge_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c   public.challenges%rowtype;
  v_p   public.challenge_participants%rowtype;
begin
  select * into v_c from public.challenges where id = p_challenge_id;
  select * into v_p from public.challenge_participants where challenge_id = p_challenge_id and user_id = v_uid for update;
  if v_p.user_id is null then raise exception 'لازم الاشتراك في التحدي الأول'; end if;
  if v_p.status = 'completed' then return json_build_object('ok', false, 'message', 'البونص اتصرف قبل كده'); end if;

  if v_c.kind = 'manual' then
    update public.challenge_participants set status = 'pending'
     where challenge_id = p_challenge_id and user_id = v_uid;
    return json_build_object('ok', true, 'status', 'pending');
  end if;

  if public.challenge_progress(p_challenge_id, v_uid) < v_c.target_count then
    return json_build_object('ok', false, 'message', 'هدف التحدي لسه مكملش');
  end if;

  update public.challenge_participants set status = 'completed', completed_at = now()
   where challenge_id = p_challenge_id and user_id = v_uid;
  insert into public.stars_ledger (user_id, amount, reason, challenge_id, note)
  values (v_uid, v_c.bonus_stars, 'challenge', p_challenge_id, v_c.title);
  return json_build_object('ok', true, 'status', 'completed', 'bonus', v_c.bonus_stars);
end $$;

-- الأدمن يوافق أو يرفض طلب تحدي يدوي
create or replace function public.review_challenge(p_challenge_id uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.challenges%rowtype;
begin
  if not public.is_admin() then raise exception 'للأدمن فقط'; end if;
  select * into v_c from public.challenges where id = p_challenge_id;

  if p_approve then
    update public.challenge_participants set status = 'completed', completed_at = now()
     where challenge_id = p_challenge_id and user_id = p_user and status = 'pending';
    if found then
      insert into public.stars_ledger (user_id, amount, reason, challenge_id, note)
      values (p_user, v_c.bonus_stars, 'challenge', p_challenge_id, v_c.title);
    end if;
  else
    update public.challenge_participants set status = 'rejected'
     where challenge_id = p_challenge_id and user_id = p_user and status = 'pending';
  end if;
end $$;

-- الأدمن يدي/يخصم نجوم يدوي
create or replace function public.admin_grant_stars(p_user uuid, p_amount integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'للأدمن فقط'; end if;
  insert into public.stars_ledger (user_id, amount, reason, note) values (p_user, p_amount, 'admin', p_note);
end $$;

-- الأدمن يغير باسورد مستخدم (مفيش إيميل نبعت عليه "نسيت الباسورد")
create or replace function public.admin_reset_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'للأدمن فقط'; end if;
  if char_length(p_password) < 6 then raise exception 'الباسورد لازم 6 حروف على الأقل'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
   where id = p_user;
end $$;

-- ---------------------------------------------------------------------
-- 10) Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.habits                 enable row level security;
alter table public.habit_logs             enable row level security;
alter table public.stars_ledger           enable row level security;
alter table public.challenges             enable row level security;
alter table public.challenge_participants enable row level security;

-- profiles: كل واحد يشوف ويعدل بياناته، والأدمن يشوف الكل
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- المستخدم ميقدرش يعدل is_admin أو stars بنفسه
revoke update on public.profiles from authenticated, anon;
grant update (display_name, gender, avatar_emoji, show_on_leaderboard, timezone, prayer_mode,
              latitude, longitude, city_name, calc_method, madhab, inactivity_days,
              last_seen_challenges_at)
  on public.profiles to authenticated;

-- habits: ملك صاحبها بس
drop policy if exists "habits own" on public.habits;
create policy "habits own" on public.habits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- habit_logs / stars: قراءة بس، الكتابة عن طريق الـ RPC
drop policy if exists "logs read own" on public.habit_logs;
create policy "logs read own" on public.habit_logs for select using (user_id = auth.uid());
drop policy if exists "stars read own" on public.stars_ledger;
create policy "stars read own" on public.stars_ledger for select using (user_id = auth.uid() or public.is_admin());

-- challenges: الكل يقرأ، الأدمن بس يضيف ويعدل ويمسح
drop policy if exists "challenges read" on public.challenges;
create policy "challenges read" on public.challenges for select using (auth.uid() is not null);
drop policy if exists "challenges admin" on public.challenges;
create policy "challenges admin" on public.challenges for all
  using (public.is_admin()) with check (public.is_admin());

-- participants: المستخدم يشوف مشاركاته، والأدمن يشوف الكل. الكتابة عن طريق الـ RPC
drop policy if exists "participants read" on public.challenge_participants;
create policy "participants read" on public.challenge_participants for select
  using (user_id = auth.uid() or public.is_admin());

-- صلاحيات صريحة (عشان يشتغل حتى لو "Automatically expose new tables" مقفولة)
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select on public.habit_logs, public.stars_ledger, public.challenge_participants to authenticated;
grant select, insert, update, delete on public.challenges to authenticated;
grant execute on function
  public.is_admin(), public.user_today(uuid), public.period_start(text, date), public.period_bonus(text),
  public.log_habit(uuid), public.unlog_habit(uuid), public.my_activity(date),
  public.get_leaderboard(text, text), public.challenge_progress(uuid, uuid),
  public.join_challenge(uuid), public.claim_challenge(uuid),
  public.review_challenge(uuid, uuid, boolean), public.admin_grant_stars(uuid, integer, text),
  public.admin_reset_password(uuid, text)
  to authenticated;

-- مفيش حد يستدعي الدوال الداخلية دي من برة
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_stars()      from public, anon, authenticated;

-- =====================================================================
-- بعد ما تسجلي حسابك من التطبيق، خلّي نفسك أدمن (حطي اسم المستخدم بتاعك):
--   update public.profiles set is_admin = true where username = 'YOUR_USERNAME';
-- =====================================================================
