const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createBusType(req, res) {
  try {
    const { name, seatCount } = req.body;
    if (!name || typeof seatCount !== "number")
      return res.status(400).json({ message: "name and seatCount required" });

    const bt = await prisma.busType.create({ data: { name, seatCount } });
    res.status(201).json({ message: "Bus type created", busType: bt });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error creating bus type", error: e.message });
  }
}

async function listBusTypes(req, res) {
  try {
    const list = await prisma.busType.findMany({ include: { seats: true } });
    const shaped = list.map((b) => ({
      id: b.id,
      name: b.name,
      seatCountDeclared: b.seatCount,
      seatCountActual: b.seats.length,
    }));
    res.json(shaped);
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error listing bus types", error: e.message });
  }
}

async function generateSeatMapGrid(req, res) {
  try {
    const busTypeId = parseInt(req.params.id, 10);
    const { rows, cols } = req.body;
    if (!rows || !cols)
      return res.status(400).json({ message: "rows and cols required" });

    const data = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) data.push({ busTypeId, row: r, col: c });
    }
    const created = await prisma.seat.createMany({
      data,
      skipDuplicates: true,
    });
    res.json({
      message: "Seat map generated",
      created: created.count,
      rows,
      cols,
    });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error generating seat map", error: e.message });
  }
}

async function listSeatsByBusType(req, res) {
  try {
    const busTypeId = parseInt(req.params.id, 10);
    const seats = await prisma.seat.findMany({
      where: { busTypeId },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });
    res.json(seats);
  } catch (e) {
    res.status(500).json({ message: "Error listing seats", error: e.message });
  }
}

module.exports = {
  createBusType,
  listBusTypes,
  generateSeatMapGrid,
  listSeatsByBusType,
};
