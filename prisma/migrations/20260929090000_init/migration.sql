-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('manager', 'field_officer');

-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');

-- CreateEnum
CREATE TYPE "meeting_frequency" AS ENUM ('weekly', 'fortnightly', 'monthly');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "priority_reason" AS ENUM ('overdue', 'disbursement', 'new_group', 'routine');

-- CreateEnum
CREATE TYPE "group_source" AS ENUM ('synthetic', 'manual');

-- CreateEnum
CREATE TYPE "plan_status" AS ENUM ('optimal', 'feasible', 'partial', 'infeasible');

-- CreateEnum
CREATE TYPE "unassigned_reason" AS ENUM ('time_window_conflict', 'exceeds_working_hours', 'low_priority_dropped', 'unreachable');

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "taluka" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_lat" DOUBLE PRECISION NOT NULL,
    "start_lng" DOUBLE PRECISION NOT NULL,
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "break_start" TEXT NOT NULL,
    "break_duration_min" INTEGER NOT NULL,
    "max_meetings_per_day" INTEGER NOT NULL,
    "vehicle" TEXT NOT NULL DEFAULT 'two_wheeler',
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "branch_id" UUID NOT NULL,
    "officer_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "branch_id" UUID NOT NULL,
    "default_shift_start" TEXT NOT NULL DEFAULT '08:30',
    "default_shift_end" TEXT NOT NULL DEFAULT '17:30',
    "default_break_start" TEXT NOT NULL DEFAULT '13:00',
    "default_break_duration_min" INTEGER NOT NULL DEFAULT 30,
    "default_meeting_duration_min" INTEGER NOT NULL DEFAULT 30,
    "osrm_url" TEXT NOT NULL DEFAULT 'https://router.project-osrm.org',
    "speed_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "buffer_min" INTEGER NOT NULL DEFAULT 5,
    "penalty_high" INTEGER NOT NULL DEFAULT 1000,
    "penalty_medium" INTEGER NOT NULL DEFAULT 300,
    "penalty_low" INTEGER NOT NULL DEFAULT 50,
    "allow_late_arrival" BOOLEAN NOT NULL DEFAULT false,
    "solver_time_limit_sec" INTEGER NOT NULL DEFAULT 10,
    "balance_workload" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("branch_id")
);

-- CreateTable
CREATE TABLE "jlg_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "center_code" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "taluka" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "member_count" INTEGER NOT NULL,
    "meeting_day" "weekday" NOT NULL,
    "meeting_frequency" "meeting_frequency" NOT NULL DEFAULT 'weekly',
    "window_start" TEXT NOT NULL,
    "window_end" TEXT NOT NULL,
    "meeting_duration_min" INTEGER NOT NULL,
    "priority" "priority" NOT NULL,
    "priority_reason" "priority_reason" NOT NULL,
    "assigned_officer_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" "group_source" NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jlg_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "plan_status" NOT NULL,
    "solve_time_sec" DOUBLE PRECISION NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "meetings_planned" INTEGER NOT NULL,
    "meetings_total" INTEGER NOT NULL,
    "high_priority_covered" INTEGER NOT NULL,
    "high_priority_total" INTEGER NOT NULL,
    "total_distance_km" DOUBLE PRECISION NOT NULL,
    "total_travel_min" INTEGER NOT NULL,
    "avg_utilization_pct" DOUBLE PRECISION NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "total_travel_min" INTEGER NOT NULL,
    "total_distance_km" DOUBLE PRECISION NOT NULL,
    "total_wait_min" INTEGER NOT NULL,
    "total_meeting_min" INTEGER NOT NULL,
    "return_travel_min" INTEGER NOT NULL,
    "return_distance_km" DOUBLE PRECISION NOT NULL,
    "break_start" TEXT,
    "break_end" TEXT,
    "geometry" JSONB NOT NULL,

    CONSTRAINT "plan_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "group_id" UUID NOT NULL,
    "arrival_time" TEXT NOT NULL,
    "wait_min" INTEGER NOT NULL,
    "meeting_start" TEXT NOT NULL,
    "meeting_end" TEXT NOT NULL,
    "departure_time" TEXT NOT NULL,
    "travel_min_from_prev" INTEGER NOT NULL,
    "distance_km_from_prev" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "plan_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_unassigned" (
    "plan_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "reason" "unassigned_reason" NOT NULL,

    CONSTRAINT "plan_unassigned_pkey" PRIMARY KEY ("plan_id","group_id")
);

-- CreateTable
CREATE TABLE "travel_cache" (
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "duration_sec" DOUBLE PRECISION NOT NULL,
    "distance_m" DOUBLE PRECISION NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_cache_pkey" PRIMARY KEY ("origin","destination")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_officer_id_key" ON "users"("officer_id");

-- CreateIndex
CREATE INDEX "jlg_groups_branch_id_meeting_day_active_idx" ON "jlg_groups"("branch_id", "meeting_day", "active");

-- CreateIndex
CREATE INDEX "plans_branch_id_date_idx" ON "plans"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "plan_routes_plan_id_officer_id_key" ON "plan_routes"("plan_id", "officer_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_stops_route_id_sequence_key" ON "plan_stops"("route_id", "sequence");

-- AddForeignKey
ALTER TABLE "officers" ADD CONSTRAINT "officers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jlg_groups" ADD CONSTRAINT "jlg_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jlg_groups" ADD CONSTRAINT "jlg_groups_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jlg_groups" ADD CONSTRAINT "jlg_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_routes" ADD CONSTRAINT "plan_routes_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_routes" ADD CONSTRAINT "plan_routes_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_stops" ADD CONSTRAINT "plan_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "plan_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_stops" ADD CONSTRAINT "plan_stops_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "jlg_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_unassigned" ADD CONSTRAINT "plan_unassigned_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_unassigned" ADD CONSTRAINT "plan_unassigned_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "jlg_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ════════════════════════════════════════════════════════════════════
-- Hand-written below: things Prisma's schema language cannot express.
-- ════════════════════════════════════════════════════════════════════

-- ─── Check constraints ───────────────────────────────────────────────
-- A second line of defence behind the API's zod validation.
-- Times of day are 24-hour "HH:MM" text; once the format is enforced,
-- plain text comparison ('09:30' < '10:00') orders them correctly.
-- Locations must lie inside Maharashtra (lat 15.6–22.1, lng 72.6–80.9).

ALTER TABLE "branches"
  ADD CONSTRAINT "branches_location_in_maharashtra"
    CHECK ("lat" BETWEEN 15.6 AND 22.1 AND "lng" BETWEEN 72.6 AND 80.9);

ALTER TABLE "officers"
  ADD CONSTRAINT "officers_start_in_maharashtra"
    CHECK ("start_lat" BETWEEN 15.6 AND 22.1 AND "start_lng" BETWEEN 72.6 AND 80.9),
  ADD CONSTRAINT "officers_times_hhmm"
    CHECK ("shift_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       AND "shift_end"   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       AND "break_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "officers_shift_end_after_start"
    CHECK ("shift_end" > "shift_start"),
  ADD CONSTRAINT "officers_break_duration_range"
    CHECK ("break_duration_min" BETWEEN 0 AND 120),
  ADD CONSTRAINT "officers_max_meetings_range"
    CHECK ("max_meetings_per_day" BETWEEN 1 AND 20),
  ADD CONSTRAINT "officers_vehicle_two_wheeler"
    CHECK ("vehicle" = 'two_wheeler'),
  ADD CONSTRAINT "officers_color_hex"
    CHECK ("color" ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE "users"
  ADD CONSTRAINT "users_field_officer_has_officer"
    CHECK ("role" <> 'field_officer' OR "officer_id" IS NOT NULL),
  ADD CONSTRAINT "users_email_lowercase"
    CHECK ("email" = lower("email"));

ALTER TABLE "jlg_groups"
  ADD CONSTRAINT "jlg_groups_location_in_maharashtra"
    CHECK ("lat" BETWEEN 15.6 AND 22.1 AND "lng" BETWEEN 72.6 AND 80.9),
  ADD CONSTRAINT "jlg_groups_window_hhmm"
    CHECK ("window_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       AND "window_end"   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "jlg_groups_window_end_after_start"
    CHECK ("window_end" > "window_start"),
  ADD CONSTRAINT "jlg_groups_meeting_duration_range"
    CHECK ("meeting_duration_min" BETWEEN 10 AND 120),
  ADD CONSTRAINT "jlg_groups_member_count_range"
    CHECK ("member_count" BETWEEN 1 AND 50);

ALTER TABLE "settings"
  ADD CONSTRAINT "settings_times_hhmm"
    CHECK ("default_shift_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       AND "default_shift_end"   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       AND "default_break_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "settings_shift_end_after_start"
    CHECK ("default_shift_end" > "default_shift_start"),
  ADD CONSTRAINT "settings_break_duration_range"
    CHECK ("default_break_duration_min" BETWEEN 0 AND 120),
  ADD CONSTRAINT "settings_meeting_duration_range"
    CHECK ("default_meeting_duration_min" BETWEEN 10 AND 120),
  ADD CONSTRAINT "settings_speed_factor_range"
    CHECK ("speed_factor" BETWEEN 0.5 AND 1.5),
  ADD CONSTRAINT "settings_buffer_non_negative"
    CHECK ("buffer_min" >= 0),
  ADD CONSTRAINT "settings_penalties_non_negative"
    CHECK ("penalty_high" >= 0 AND "penalty_medium" >= 0 AND "penalty_low" >= 0),
  ADD CONSTRAINT "settings_solver_time_limit_range"
    CHECK ("solver_time_limit_sec" BETWEEN 1 AND 60);

ALTER TABLE "plans"
  ADD CONSTRAINT "plans_meetings_planned_within_total"
    CHECK ("meetings_planned" BETWEEN 0 AND "meetings_total"),
  ADD CONSTRAINT "plans_high_priority_within_total"
    CHECK ("high_priority_covered" BETWEEN 0 AND "high_priority_total");

ALTER TABLE "travel_cache"
  ADD CONSTRAINT "travel_cache_values_non_negative"
    CHECK ("duration_sec" >= 0 AND "distance_m" >= 0);


-- ─── Row Level Security ──────────────────────────────────────────────
-- Enabled on every table with NO policies. Prisma connects as the table
-- owner and bypasses RLS; Supabase's public REST API (anon key) sees nothing.

ALTER TABLE "branches"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "officers"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jlg_groups"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_routes"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_stops"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_unassigned" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "travel_cache"    ENABLE ROW LEVEL SECURITY;
