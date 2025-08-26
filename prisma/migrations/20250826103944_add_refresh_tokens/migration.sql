-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "refreshTokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
