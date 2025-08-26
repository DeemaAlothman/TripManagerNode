const { PrismaClient } = require("@prisma/client");
const { toJSON } = require("../_utils");
const prisma = new PrismaClient();

async function listSecurityLogs(req, res) {
  try {
    const {
      tripId,
      reservationId,
      nationalId,
      from,
      to,
      page = "1",
      pageSize = "50",
    } = req.query;
    const take = Math.min(parseInt(pageSize) || 50, 200);
    const skip = (parseInt(page) - 1) * take;

    const where = {};
    if (tripId) where.tripId = BigInt(tripId);
    if (reservationId) where.reservationId = BigInt(reservationId);
    if (nationalId)
      where.nationalId = { contains: nationalId, mode: "insensitive" };
    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to) where.recordedAt.lte = new Date(to);
    }

    const [items, total] = await Promise.all([
      prisma.securityLog.findMany({
        where,
        orderBy: { recordedAt: "desc" },
        skip,
        take,
      }),
      prisma.securityLog.count({ where }),
    ]);

    res.json({
      total,
      page: Number(page),
      pageSize: take,
      items: toJSON(items),
    });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error listing security logs", error: e.message });
  }
}

async function getSecurityLog(req, res) {
  try {
    const id = BigInt(req.params.id);
    const log = await prisma.securityLog.findUnique({ where: { id } });
    if (!log) return res.status(404).json({ message: "Not found" });
    res.json(toJSON(log));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error fetching security log", error: e.message });
  }
}

module.exports = { listSecurityLogs, getSecurityLog };
