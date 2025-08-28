// controllers/security.js (CommonJS)

const { PrismaClient, Gender } = require("@prisma/client");
const prisma = new PrismaClient();
const { toJSON, getUid } = require("./_utils");

// helper
const toId = (x) => {
  try {
    return BigInt(x);
  } catch {
    return BigInt(parseInt(x, 10) || 0);
  }
};

// POST /api/security/logs
// إنشاء سجل أمني (يمثل تحقق هوية راكب). يتطلب role=security/admin
async function createSecurityLog(req, res) {
  try {
    const {
      tripId,
      reservationId, // اختياري (قد يكون الراكب بدون حجز)
      nationalId,
      firstName,
      lastName,
      fatherName,
      motherName,
      birthDate, // ISO string
      gender, // "M" | "F"
      issuePlace,
      phone,
      notes,
    } = req.body;

    // التحقق من الحقول الأساسية
    if (!tripId || !nationalId || !firstName || !lastName || !gender) {
      return res
        .status(400)
        .json({
          message:
            "tripId, nationalId, firstName, lastName, gender are required",
        });
    }

    // هوية المسجّل من JWT
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    // تحقّق من الرحلة
    const tripPk = toId(tripId);
    const trip = await prisma.trip.findUnique({ where: { id: tripPk } });
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    // التحقق من الحجز (إن وُجد) وأنه لنفس الرحلة (اختياري لكن مفيد)
    let reservationConnect = undefined;
    if (reservationId) {
      const rId = toId(reservationId);
      const r = await prisma.reservation.findUnique({
        where: { id: rId },
        include: { trip: { select: { id: true } } },
      });
      if (!r) return res.status(404).json({ message: "Reservation not found" });
      if (r.trip?.id?.toString() !== tripPk.toString()) {
        return res
          .status(400)
          .json({
            message: "Reservation does not belong to the specified trip",
          });
      }
      reservationConnect = { connect: { id: rId } };
    }

    // Gender enum
    let genderEnum = undefined;
    if (gender === "M") genderEnum = Gender.M;
    else if (gender === "F") genderEnum = Gender.F;
    else
      return res
        .status(400)
        .json({ message: "Invalid gender, use 'M' or 'F'" });

    // إنشاء السجل عبر العلاقات
    const log = await prisma.securityLog.create({
      data: {
        trip: { connect: { id: tripPk } }, // علاقة مطلوبة
        reservation: reservationConnect ?? undefined, // علاقة اختيارية
        recorder: { connect: { id: uid } }, // المستخدم من التوكن
        nationalId,
        firstName,
        lastName,
        fatherName: fatherName ?? null,
        motherName: motherName ?? null,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: genderEnum,
        issuePlace: issuePlace ?? null,
        phone: phone ?? null,
        notes: notes ?? null,
        // recordedAt: new Date(), // لو ما عندك default(now()) في السكيمة
      },
    });

    res.status(201).json(toJSON(log));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to create security log", error: e.message });
  }
}

// PATCH /api/security/logs/:id
async function updateSecurityLog(req, res) {
  try {
    const id = toId(req.params.id);
    const {
      // لا نسمح بتغيير trip/reservation من هنا غالبًا
      nationalId,
      firstName,
      lastName,
      fatherName,
      motherName,
      birthDate,
      gender,
      issuePlace,
      phone,
      notes,
    } = req.body;

    const uid = getUid(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const log = await prisma.securityLog.findUnique({ where: { id } });
    if (!log)
      return res.status(404).json({ message: "Security log not found" });

    // gender enum (اختياري)
    let genderEnum = undefined;
    if (gender !== undefined) {
      if (gender === "M") genderEnum = Gender.M;
      else if (gender === "F") genderEnum = Gender.F;
      else return res.status(400).json({ message: "Invalid gender" });
    }

    const data = {};
    if (nationalId !== undefined) data.nationalId = nationalId;
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (fatherName !== undefined) data.fatherName = fatherName ?? null;
    if (motherName !== undefined) data.motherName = motherName ?? null;
    if (birthDate !== undefined)
      data.birthDate = birthDate ? new Date(birthDate) : null;
    if (genderEnum !== undefined) data.gender = genderEnum;
    if (issuePlace !== undefined) data.issuePlace = issuePlace ?? null;
    if (phone !== undefined) data.phone = phone ?? null;
    if (notes !== undefined) data.notes = notes ?? null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const updated = await prisma.securityLog.update({ where: { id }, data });
    res.json(toJSON(updated));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to update security log", error: e.message });
  }
}

// DELETE /api/security/logs/:id
async function deleteSecurityLog(req, res) {
  try {
    const id = toId(req.params.id);

    const uid = getUid(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const log = await prisma.securityLog.findUnique({ where: { id } });
    if (!log)
      return res.status(404).json({ message: "Security log not found" });

    await prisma.securityLog.delete({ where: { id } });
    res.json({ message: "Security log deleted" });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to delete security log", error: e.message });
  }
}

// GET /api/security/logs?tripId=1&date=2025-08-27
// يعرض السجلات مع فلترة حسب الرحلة واليوم (اختياريين)
async function listSecurityLogs(req, res) {
  try {
    const { tripId, date } = req.query;
    const where = {};

    if (tripId) where.trip = { id: toId(tripId) }; // علاقة
    if (date) {
      // نطاق اليوم: [00:00, 23:59:59]
      const d = new Date(date + "T00:00:00");
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.recordedAt = { gte: d, lt: next };
    }

    const logs = await prisma.securityLog.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      include: {
        recorder: { select: { id: true, name: true, role: true } },
        trip: {
          select: {
            id: true,
            departureDt: true,
            originLabel: true,
            destinationLabel: true,
          },
        },
        reservation: { select: { id: true } },
      },
    });

    res.json(toJSON(logs));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to fetch security logs", error: e.message });
  }
}

module.exports = {
  createSecurityLog,
  updateSecurityLog,
  deleteSecurityLog,
  listSecurityLogs,
};
