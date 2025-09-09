const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { toJSON, getUid } = require("../_utils");


const toId = (x) => {
  try {
    return BigInt(x);
  } catch {
    return BigInt(parseInt(x, 10) || 0);
  }
};

// POST /api/booking/reservations
async function createReservation(req, res) {
  try {
    const {
      tripId,
      seatId,
      passengerName,
      phone,
      boardingPoint,
      notes,
      paid,
      amount,
    } = req.body;

    if (!tripId || !seatId || !passengerName || !boardingPoint) {
      return res
        .status(400)
        .json({
          message: "tripId, seatId, passengerName, boardingPoint are required",
        });
    }
    if (
      paid === true &&
      (amount === undefined || amount === null || Number(amount) < 0)
    ) {
      return res
        .status(400)
        .json({ message: "amount must be >= 0 when paid=true" });
    }

    // 👈 هوية المستخدم من التوكن (لازم يكون داخل verifyAccessToken)
    const uid = getUid(req);
    if (!uid)
      return res
        .status(401)
        .json({ message: "Unauthorized: missing user id in token" });

    const tripPk = toId(tripId);

    // الرحلة + busType
    const trip = await prisma.trip.findUnique({
      where: { id: tripPk },
      include: { busType: { select: { id: true } } },
    });
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // المقعد لنفس نوع الباص
    const seat = await prisma.seat.findUnique({
      where: { id: Number(seatId) },
    });
    const busTypeId = Number(trip.busTypeId ?? trip.busType?.id);
    if (!seat || !busTypeId || seat.busTypeId !== busTypeId) {
      return res
        .status(400)
        .json({ message: "Seat does not belong to trip's bus type" });
    }

    // التأكد إنه غير محجوز لهذه الرحلة
    const exists = await prisma.reservation.findFirst({
      where: { trip: { id: tripPk }, seat: { id: Number(seatId) } },
    });
    if (exists)
      return res
        .status(409)
        .json({ message: "Seat already reserved for this trip" });

    // ✅ الإنشاء عبر العلاقات + ربط المُنشئ (creator)
    const reservation = await prisma.reservation.create({
      data: {
        trip: { connect: { id: tripPk } },
        seat: { connect: { id: Number(seatId) } },
        passengerName,
        phone: phone ?? null,
        boardingPoint,
        notes: notes ?? null,
        paid: !!paid,
        amount: paid ? Number(amount ?? 0) : 0,
        creator: { connect: { id: uid } }, // 👈 هذا السطر هو المطلوب حسب رسالة الخطأ
      },
    });

    res.status(201).json(toJSON(reservation));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error creating reservation", error: e.message });
  }
}

async function listAllReservations(req, res) {
  try {
    const items = await prisma.reservation.findMany({
      orderBy: { id: "asc" },
      include: {
        seat: { select: { row: true, col: true } },
        trip: {
          select: { id: true, originLabel: true, destinationLabel: true },
        },
      },
    });

    res.json(
      items.map((r) => ({
        id: r.id.toString(),
        tripId: r.trip.id.toString(),
        route: `${r.trip.originLabel} → ${r.trip.destinationLabel}`,
        row: r.seat?.row,
        col: r.seat?.col,
        passengerName: r.passengerName,
        phone: r.phone,
        boardingPoint: r.boardingPoint,
        paid: r.paid,
        amount: Number(r.amount ?? 0),
      }))
    );
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error listing reservations", error: e.message });
  }
}
// GET /api/booking/trips/:tripId/reservations
async function listTripReservations(req, res) {
  try {
    const tripId = toId(req.params.tripId);
    const items = await prisma.reservation.findMany({
      where: { trip: { id: tripId } }, // ✅
      orderBy: { id: "asc" },
      include: { seat: { select: { id: true, row: true, col: true } } },
    });

    const shaped = items.map((r) => ({
      id: r.id.toString(),
      seatId: r.seat?.id ?? null,       // ✅
      row: r.seat?.row ?? null,
      col: r.seat?.col ?? null,
      passengerName: r.passengerName,
      phone: r.phone,
      boardingPoint: r.boardingPoint,
      notes: r.notes,
      paid: r.paid,
      amount: Number(r.amount ?? 0),
    }));

    res.json(shaped);
  } catch (e) {
    res.status(500).json({ message: "Error listing reservations", error: e.message });
  }
}



// GET /api/booking/reservations/:id
async function getReservation(req, res) {
  try {
    const id = toId(req.params.id);
    const r = await prisma.reservation.findUnique({
      where: { id },
      include: { seat: { select: { id: true, row: true, col: true } }, trip: { select: { id: true } } },
    });
    if (!r) return res.status(404).json({ message: "Reservation not found" });

    res.json({
      id: r.id.toString(),
      tripId: r.trip?.id?.toString?.(),
      seatId: r.seat?.id ?? null,       // ✅
      row: r.seat?.row ?? null,
      col: r.seat?.col ?? null,
      passengerName: r.passengerName,
      phone: r.phone,
      boardingPoint: r.boardingPoint,
      notes: r.notes,
      paid: r.paid,
      amount: Number(r.amount ?? 0),
    });
  } catch (e) {
    res.status(500).json({ message: "Error fetching reservation", error: e.message });
  }
}

// PATCH /api/booking/reservations/:id

async function updateReservation(req, res) {
  try {
    const id = toId(req.params.id);
    const { passengerName, phone, boardingPoint, notes, paid, amount, seatId } = req.body;

    const current = await prisma.reservation.findUnique({
      where: { id },
      include: { trip: { select: { id: true, busType: { select: { id: true } } } }, seat: { select: { id: true } } },
    });
    if (!current) return res.status(404).json({ message: "Reservation not found" });

    const data = {};
    if (passengerName !== undefined) data.passengerName = passengerName;
    if (phone !== undefined) data.phone = phone;
    if (boardingPoint !== undefined) data.boardingPoint = boardingPoint;
    if (notes !== undefined) data.notes = notes;
    if (paid !== undefined) data.paid = !!paid;
    if (amount !== undefined) {
      if (paid === true && Number(amount) < 0) return res.status(400).json({ message: "amount must be >= 0 when paid=true" });
      data.amount = Number(amount);
    }

    if (seatId !== undefined && Number(seatId) !== Number(current.seat?.id)) {
      const busTypeId = Number(current.trip.busType?.id);
      const seat = await prisma.seat.findUnique({ where: { id: Number(seatId) } });
      if (!seat || seat.busTypeId !== busTypeId) {
        return res.status(400).json({ message: "Seat does not belong to trip's bus type" });
      }
      const occupied = await prisma.reservation.findFirst({
        where: { trip: { id: current.trip.id }, seat: { id: Number(seatId) }, NOT: { id } }, // ✅
      });
      if (occupied) return res.status(409).json({ message: "Target seat already reserved" });

      data.seat = { connect: { id: Number(seatId) } }; // ✅
    }

    const updated = await prisma.reservation.update({ where: { id }, data });
    res.json(toJSON(updated));
  } catch (e) {
    res.status(500).json({ message: "Error updating reservation", error: e.message });
  }
}


// DELETE /api/booking/reservations/:id
async function deleteReservation(req, res) {
  try {
    const id = toId(req.params.id);
    await prisma.reservation.delete({ where: { id } });
    res.json({ message: "Reservation canceled" });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error canceling reservation", error: e.message });
  }
}

module.exports = {
  createReservation,
  listAllReservations, // 👈 أضفها هون

  listTripReservations,
  getReservation,
  updateReservation,
  deleteReservation,
};
