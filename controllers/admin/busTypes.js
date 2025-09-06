// controllers/admin.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* ✅ إنشاء نوع باص جديد */
async function createBusType(req, res) {
  try {
    const { name, seatCount } = req.body;
    if (!name || typeof seatCount !== "number") {
      return res.status(400).json({ message: "name and seatCount required" });
    }

    const bt = await prisma.busType.create({
      data: { name, seatCount },
    });

    res.status(201).json({ message: "Bus type created", busType: bt });
  } catch (e) {
    console.error("Error creating bus type:", e);
    res
      .status(500)
      .json({ message: "Error creating bus type", error: e.message });
  }
}

/* ✅ جلب أنواع الباصات */
async function listBusTypes(req, res) {
  try {
    const list = await prisma.busType.findMany({
      include: { seats: true },
    });

    const shaped = list.map((b) => ({
      id: b.id,
      name: b.name,
      seatCountDeclared: b.seatCount,
      seatCountActual: b.seats.length,
    }));

    res.json(shaped);
  } catch (e) {
    console.error("Error listing bus types:", e);
    res
      .status(500)
      .json({ message: "Error listing bus types", error: e.message });
  }
}

/* ✅ توليد خريطة المقاعد */
async function generateSeatMapGrid(req, res) {
  try {
    const busTypeId = parseInt(req.params.id, 10);
    const { rows, cols } = req.body;

    if (!rows || !cols) {
      return res.status(400).json({ message: "rows and cols required" });
    }

    // ✅ احذف المقاعد القديمة إذا ما فيها حجوزات
    const linkedReservations = await prisma.reservation.count({
      where: { seat: { busTypeId } },
    });
    if (linkedReservations > 0) {
      return res
        .status(400)
        .json({
          message: "لا يمكن إعادة توليد المقاعد لأن هناك حجوزات مرتبطة",
        });
    }

    await prisma.seat.deleteMany({ where: { busTypeId } });

    const data = [];
    let counter = 1;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        data.push({ busTypeId, row: r, col: c });
        counter++;
      }
    }

    await prisma.seat.createMany({ data, skipDuplicates: true });

    res.json({
      message: "Seat map generated",
      rows,
      cols,
      created: data.length,
    });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error generating seat map", error: e.message });
  }
}


/* ✅ جلب المقاعد لباص */
async function listSeatsByBusType(req, res) {
  try {
    const busTypeId = parseInt(req.params.id, 10);

    const seats = await prisma.seat.findMany({
      where: { busTypeId },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });

    res.json(seats);
  } catch (e) {
    console.error("Error listing seats:", e);
    res.status(500).json({ message: "Error listing seats", error: e.message });
  }
}

module.exports = {
  createBusType,
  listBusTypes,
  generateSeatMapGrid,
  listSeatsByBusType,
};
