-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "text_raw" TEXT,
ALTER COLUMN "text" DROP NOT NULL;
