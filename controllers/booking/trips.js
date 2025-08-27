const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { toJSON, getUid } = require("../_utils"); // ← تأكدي من هذا الاستيراد

const toId = (x) => {
  try {
    return BigInt(x);
  } catch {
    return BigInt(parseInt(x, 10) || 0);
  }
};

// POST /api/booking/trips
async function createTrip(req, res) {
  try {
    const {
      busTypeId,
      departureDt,
      originLabel,
      destinationLabel,
      durationMinutes,
      driverName,
    } = req.body;

    if (!busTypeId || !departureDt || !originLabel || !destinationLabel) {
      return res
        .status(400)
        .json({
          message:
            "busTypeId, departureDt, originLabel, destinationLabel are required",
        });
    }

    const bt = await prisma.busType.findUnique({
      where: { id: Number(busTypeId) },
    });
    if (!bt) return res.status(404).json({ message: "Bus type not found" });

    const uid = getUid(req);
    if (!uid)
      return res
        .status(401)
        .json({ message: "Unauthorized: missing user id in token" });

    const trip = await prisma.trip.create({
      data: {
        // لأن العلاقة ضمنية/إلزامية: لازم نستخدم connect
        busType: { connect: { id: Number(busTypeId) } },
        creator: { connect: { id: uid } }, // ← هذا هو المطلوب بحسب الخطأ
        departureDt: new Date(departureDt),
        originLabel,
        destinationLabel,
        durationMinutes: durationMinutes ?? null,
        driverName: driverName ?? null,
        // إذا كان اسم العلاقة مختلف في سكيمتك (مثلاً createdBy):
        // createdBy: { connect: { id: uid } },
      },
    });

    res.status(201).json(toJSON(trip));
  } catch (e) {
    res.status(500).json({ message: "Error creating trip", error: e.message });
  }
}

// GET /api/booking/trips
async function listTrips(req, res) {
  try {
    const { from, to, status, busTypeId } = req.query;
    const where = {};

    if (status) where.status = status;
    if (from || to) {
      where.departureDt = {};
      if (from) where.departureDt.gte = new Date(from);
      if (to) where.departureDt.lte = new Date(to);
    }
    // ✅ فلترة على العلاقة بدل busTypeId
    if (busTypeId) where.busType = { id: Number(busTypeId) };

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { departureDt: "asc" },
      include: {
        busType: true,
        _count: { select: { reservations: true } },
      },
    });

    res.json(toJSON(trips));
  } catch (e) {
    res.status(500).json({ message: "Error listing trips", error: e.message });
  }
}

// GET /api/booking/trips/:tripId
async function getTrip(req, res) {
  try {
    const tripId = toId(req.params.tripId);
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        busType: true,
        _count: { select: { reservations: true } },
      },
    });
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    res.json(toJSON(trip));
  } catch (e) {
    res.status(500).json({ message: "Error fetching trip", error: e.message });
  }
}

// PATCH /api/booking/trips/:tripId
async function updateTrip(req, res) {
  try {
    const tripId = toId(req.params.tripId);
    const {
      departureDt,
      originLabel,
      destinationLabel,
      durationMinutes,
      driverName,
      status,
    } = req.body;

    const data = {};
    if (departureDt !== undefined) data.departureDt = new Date(departureDt);
    if (originLabel !== undefined) data.originLabel = originLabel;
    if (destinationLabel !== undefined)
      data.destinationLabel = destinationLabel;
    if (durationMinutes !== undefined) data.durationMinutes = durationMinutes;
    if (driverName !== undefined) data.driverName = driverName;
    if (status !== undefined) data.status = status;

    const updated = await prisma.trip.update({ where: { id: tripId }, data });
    res.json(toJSON(updated));
  } catch (e) {
    res.status(500).json({ message: "Error updating trip", error: e.message });
  }
}

module.exports = { createTrip, listTrips, getTrip, updateTrip };

