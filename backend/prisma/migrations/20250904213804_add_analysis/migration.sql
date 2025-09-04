-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "is_finished" BOOLEAN NOT NULL DEFAULT false;
