-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('admin', 'booking', 'security', 'ops');

-- CreateEnum
CREATE TYPE "public"."TripStatus" AS ENUM ('scheduled', 'boarding', 'departed', 'canceled', 'completed');

-- CreateEnum
CREATE TYPE "public"."SeatStatus" AS ENUM ('available', 'held', 'reserved', 'blocked');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "public"."ScanMethod" AS ENUM ('manual', 'qr', 'nfc', 'other');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(40),
    "role" "public"."UserRole" NOT NULL,
    "passwordHash" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusType" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "seatCount" INTEGER NOT NULL,

    CONSTRAINT "BusType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Seat" (
    "id" SERIAL NOT NULL,
    "busTypeId" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trip" (
    "id" BIGSERIAL NOT NULL,
    "busTypeId" INTEGER NOT NULL,
    "departureDt" TIMESTAMP(3) NOT NULL,
    "originLabel" VARCHAR(120),
    "destinationLabel" VARCHAR(120),
    "durationMinutes" INTEGER,
    "driverName" VARCHAR(120),
    "status" "public"."TripStatus" NOT NULL DEFAULT 'scheduled',
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TripSeat" (
    "tripId" BIGINT NOT NULL,
    "seatId" INTEGER NOT NULL,
    "status" "public"."SeatStatus" NOT NULL DEFAULT 'available',

    CONSTRAINT "TripSeat_pkey" PRIMARY KEY ("tripId","seatId")
);

-- CreateTable
CREATE TABLE "public"."Reservation" (
    "id" BIGSERIAL NOT NULL,
    "tripId" BIGINT NOT NULL,
    "seatId" INTEGER NOT NULL,
    "passengerName" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(40),
    "boardingPoint" VARCHAR(120),
    "notes" VARCHAR(255),
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SecurityLog" (
    "id" BIGSERIAL NOT NULL,
    "tripId" BIGINT NOT NULL,
    "reservationId" BIGINT,
    "nationalId" VARCHAR(20) NOT NULL,
    "firstName" VARCHAR(60) NOT NULL,
    "lastName" VARCHAR(60) NOT NULL,
    "fatherName" VARCHAR(60),
    "motherName" VARCHAR(60),
    "birthDate" DATE,
    "gender" "public"."Gender" NOT NULL,
    "issuePlace" VARCHAR(80),
    "phone" VARCHAR(40),
    "scanMethod" "public"."ScanMethod" NOT NULL DEFAULT 'manual',
    "notes" VARCHAR(255),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" BIGINT NOT NULL,

    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seat_busTypeId_row_col_key" ON "public"."Seat"("busTypeId", "row", "col");

-- CreateIndex
CREATE INDEX "SecurityLog_tripId_recordedAt_idx" ON "public"."SecurityLog"("tripId", "recordedAt");

-- CreateIndex
CREATE INDEX "SecurityLog_reservationId_idx" ON "public"."SecurityLog"("reservationId");

-- AddForeignKey
ALTER TABLE "public"."Seat" ADD CONSTRAINT "Seat_busTypeId_fkey" FOREIGN KEY ("busTypeId") REFERENCES "public"."BusType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_busTypeId_fkey" FOREIGN KEY ("busTypeId") REFERENCES "public"."BusType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripSeat" ADD CONSTRAINT "TripSeat_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripSeat" ADD CONSTRAINT "TripSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "public"."Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "public"."Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SecurityLog" ADD CONSTRAINT "SecurityLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SecurityLog" ADD CONSTRAINT "SecurityLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SecurityLog" ADD CONSTRAINT "SecurityLog_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
