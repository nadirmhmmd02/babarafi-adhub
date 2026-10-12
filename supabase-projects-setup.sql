-- ============================================================
-- BABA RAFI AD HUB — SETUP TABEL "PROJECTS" (halaman /projects, Workspace)
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
--
-- Dua tabel:
--   project_groups : kolom/lajur di papan (urutan kiri → kanan). Kartu yang
--                    berdiri sendiri juga punya baris grup (nama kosong);
--                    grup berisi 2+ kartu tampil dengan judul grup.
--   projects       : kartu project. Langkah/sub-tugas disimpan sebagai JSON
--                    di kolom steps:
--                    [{ "id": "...", "title": "...", "done": false, "pic": "Nadir" }]
-- Semua PRIBADI per akun (RLS: hanya pemilik baris), sama seperti To Do.
-- Data To Do (todos / todo_lists) TIDAK disentuh.
-- ============================================================

create table if not exists public.project_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default '',
  sort_order  integer not null default 0,              -- urutan lajur, kiri → kanan
  width       integer,                                 -- lebar kartu hasil geser (px); NULL = lebar bawaan
  created_at  timestamptz not null default now()
);
-- untuk yang sudah menjalankan versi awal file ini (12 Okt 2026, sebelum fitur lebar kartu)
alter table public.project_groups add column if not exists width integer;

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- restrict: grup hanya boleh dihapus kalau sudah kosong (anti kartu ikut terhapus)
  group_id    uuid not null references public.project_groups(id) on delete restrict,
  title       text not null default 'Untitled project',
  status      text not null default 'todo' check (status in ('todo', 'progress', 'waiting', 'done')),
  due_date    date,                                    -- tenggat
  notes       text not null default '',
  steps       jsonb not null default '[]'::jsonb,      -- langkah / sub-tugas
  sort_order  integer not null default 0,              -- urutan di dalam grup, atas → bawah
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists project_groups_user_idx on public.project_groups (user_id, sort_order);
create index if not exists projects_group_idx      on public.projects (group_id, sort_order);
create index if not exists projects_user_idx       on public.projects (user_id);

alter table public.project_groups enable row level security;
alter table public.projects       enable row level security;

drop policy if exists "project_groups owner full access" on public.project_groups;
create policy "project_groups owner full access" on public.project_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects owner full access" on public.projects;
create policy "projects owner full access" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at otomatis — TIDAK berubah kalau yang di-update cuma posisi kartu
-- (geser urutan / pindah grup), supaya "terakhir diubah" tetap jujur.
create or replace function public.touch_projects_updated_at()
returns trigger language plpgsql as $$
begin
  if (new.title, new.status, new.due_date, new.notes, new.steps)
     is distinct from (old.title, old.status, old.due_date, old.notes, old.steps) then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_projects_updated_at();
