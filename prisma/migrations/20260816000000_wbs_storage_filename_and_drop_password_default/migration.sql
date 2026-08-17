-- AlterTable
ALTER TABLE "Project" ADD COLUMN "wbs_storage_filename" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" DROP DEFAULT;
