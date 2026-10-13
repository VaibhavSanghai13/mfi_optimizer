-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "travel_allowance_per_km" DOUBLE PRECISION NOT NULL DEFAULT 4.0;

-- CreateTable
CREATE TABLE "allowance_approvals" (
    "officer_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "branch_id" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" UUID NOT NULL,

    CONSTRAINT "allowance_approvals_pkey" PRIMARY KEY ("officer_id","week_start")
);

-- CreateIndex
CREATE INDEX "allowance_approvals_branch_id_week_start_idx" ON "allowance_approvals"("branch_id", "week_start");

-- AddForeignKey
ALTER TABLE "allowance_approvals" ADD CONSTRAINT "allowance_approvals_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_approvals" ADD CONSTRAINT "allowance_approvals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_approvals" ADD CONSTRAINT "allowance_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
