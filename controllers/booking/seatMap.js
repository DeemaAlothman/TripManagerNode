const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { toJSON } = require("../_utils");

const toId = (x) => {
  try {
    return BigInt(x);
  } catch {
    return BigInt(parseInt(x, 10) || 0);
  }
};

// GET /api/booking/trips/:tripId/seat-map
async function getSeatMap(req, res) {
  try {
    const tripId = toId(req.params.tripId);

    // جيب الرحلة مع busType.id (لو ما عندك trip.busTypeId كسكالار)
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { busType: { select: { id: true } } },
    });
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // استخرج busTypeId من السكالار إن وجد، وإلا من العلاقة
    const busTypeId = Number(trip.busTypeId ?? trip.busType?.id);
    if (!busTypeId) {
      return res.status(500).json({ message: "Trip busType not resolved" });
    }

    // كل مقاعد نوع الباص
    const seats = await prisma.seat.findMany({
      where: { busTypeId },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });

    // حجوزات الرحلة الحالية - عبر العلاقة (بدون tripId scalar)
    const reservations = await prisma.reservation.findMany({
      where: { trip: { id: tripId } },
      select: {
        id: true,
        passengerName: true,
        seat: { select: { id: true } },
      },
    });

    // خريطة المقاعد المحجوزة key=seat.id
    const reservedMap = new Map();
    for (const r of reservations) {
      const sid = Number(r.seat?.id);
      if (sid) reservedMap.set(sid, r);
    }

    const result = {
      tripId: trip.id.toString(),
      busTypeId,
      seats: seats.map((s) => {
        const r = reservedMap.get(s.id);
        return r
          ? {
              seatId: s.id,
              row: s.row,
              col: s.col,
              reserved: true,
              reservationId: r.id.toString(),
              passengerName: r.passengerName,
            }
          : {
              seatId: s.id,
              row: s.row,
              col: s.col,
              reserved: false,
            };
      }),
    };

    res.json(result);
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error building seat map", error: e.message });
  }
}

// GET /api/booking/trips/:tripId/seats/available
async function getAvailableSeats(req, res) {
  try {
    const tripId = toId(req.params.tripId);

    // جيب الرحلة + busType.id
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { busType: { select: { id: true } } },
    });
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const busTypeId = Number(trip.busTypeId ?? trip.busType?.id);
    if (!busTypeId) {
      return res.status(500).json({ message: "Trip busType not resolved" });
    }

    // كل مقاعد نوع الباص + المقاعد المحجوزة لهذه الرحلة عبر العلاقة
    const [seats, reserved] = await Promise.all([
      prisma.seat.findMany({ where: { busTypeId }, select: { id: true } }),
      prisma.reservation.findMany({
        where: { trip: { id: tripId } },
        select: { seat: { select: { id: true } } },
      }),
    ]);

    const reservedSet = new Set(
      reserved.map((r) => Number(r.seat?.id)).filter(Boolean)
    );

    const availableSeatIds = seats
      .map((s) => s.id)
      .filter((id) => !reservedSet.has(id));

    res.json({ tripId: trip.id.toString(), busTypeId, availableSeatIds });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error listing available seats", error: e.message });
  }
}

module.exports = { getSeatMap, getAvailableSeats };
