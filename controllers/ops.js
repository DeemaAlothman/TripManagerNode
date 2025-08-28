const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { toJSON, getUid } = require("./_utils");
const path = require("path");
const PdfPrinter = require("pdfmake");

const toId = (x) => {
  try {
    return BigInt(x);
  } catch {
    return BigInt(parseInt(x, 10) || 0);
  }
};

// POST /api/ops/trips
async function createTrip(req, res) {
  try {
    // uid من التوكن (التحقق من الدور يتم بالراوتر عبر checkRole)
    const uid = getUid(req);
    const {
      originLabel,
      destinationLabel,
      driverName,
      departureTime,
      busTypeId,
    } = req.body;

    if (
      !originLabel ||
      !destinationLabel ||
      !driverName ||
      !departureTime ||
      !busTypeId
    ) {
      return res.status(400).json({
        message:
          "originLabel, destinationLabel, driverName, departureTime, busTypeId are required",
      });
    }

    // تأكد أن نوع الباص موجود
    const bt = await prisma.busType.findUnique({
      where: { id: Number(busTypeId) },
    });
    if (!bt) return res.status(404).json({ message: "Bus type not found" });

    const trip = await prisma.trip.create({
      data: {
        originLabel,
        destinationLabel,
        driverName,
        departureDt: new Date(departureTime),
        busType: { connect: { id: Number(busTypeId) } },
        creator: { connect: { id: uid } }, // أنشأها متسيّر الرحلات
        status: "scheduled",
      },
    });

    res.status(201).json(toJSON(trip));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to create trip", error: e.message });
  }
}

// PATCH /api/ops/trips/:tripId
async function updateTrip(req, res) {
  try {
    const tripId = toId(req.params.tripId);
    const {
      originLabel,
      destinationLabel,
      driverName,
      departureTime,
      busTypeId,
      status,
    } = req.body;

    const data = {};
    if (originLabel !== undefined) data.originLabel = originLabel;
    if (destinationLabel !== undefined)
      data.destinationLabel = destinationLabel;
    if (driverName !== undefined) data.driverName = driverName;
    if (departureTime !== undefined) data.departureDt = new Date(departureTime);
    if (status !== undefined) data.status = status;

    if (busTypeId !== undefined) {
      const bt = await prisma.busType.findUnique({
        where: { id: Number(busTypeId) },
      });
      if (!bt) return res.status(404).json({ message: "Bus type not found" });
      data.busType = { connect: { id: Number(busTypeId) } };
    }

    const updated = await prisma.trip.update({ where: { id: tripId }, data });
    res.json(toJSON(updated));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to update trip", error: e.message });
  }
}

// DELETE /api/ops/trips/:tripId
async function deleteTrip(req, res) {
  try {
    const tripId = toId(req.params.tripId);
    await prisma.trip.delete({ where: { id: tripId } });
    res.json({ message: "Trip deleted successfully" });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to delete trip", error: e.message });
  }
}

// GET /api/ops/trips/:tripId/passengers
async function getTripPassengers(req, res) {
  try {
    const tripId = toId(req.params.tripId);
    const reservations = await prisma.reservation.findMany({
      where: { trip: { id: tripId } },
      select: {
        passengerName: true,
        phone: true,
        boardingPoint: true,
        seat: { select: { row: true, col: true, id: true } },
        paid: true,
        amount: true,
      },
      orderBy: [{ id: "asc" }],
    });
    res.json(toJSON(reservations));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to fetch passengers", error: e.message });
  }
}

// GET /api/ops/trips/:tripId/payments-summary
async function getTripPaymentsSummary(req, res) {
  try {
    const tripId = toId(req.params.tripId);

    const [agg, counts] = await Promise.all([
      prisma.reservation.aggregate({
        where: { trip: { id: tripId }, paid: true },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.reservation
        .groupBy({
          where: { trip: { id: tripId } },
          by: ["paid"],
          _count: { _all: true },
        })
        .catch(() => []),
    ]);

    const totalPaid = agg._sum.amount ?? 0;
    const paidCount = counts.find((c) => c.paid === true)?._count._all ?? 0;
    const unpaidCount = counts.find((c) => c.paid === false)?._count._all ?? 0;

    res.json({ tripId: tripId.toString(), totalPaid, paidCount, unpaidCount });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to fetch payments summary", error: e.message });
  }
}

// POST /api/ops/trips/:tripId/passengers  (اسم فقط، بدون دفع/صعود)
async function addPassenger(req, res) {
  try {
    const uid = getUid(req);
    const tripId = toId(req.params.tripId);
    const { passengerName, seatId } = req.body;

    if (!passengerName)
      return res.status(400).json({ message: "passengerName is required" });

    // التحقق من المقعد (اختياري) ومن انتمائه لنوع الباص للرحلة:
    let seatConnect = undefined;
    if (seatId !== undefined && seatId !== null) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: { busType: { select: { id: true } } },
      });
      if (!trip) return res.status(404).json({ message: "Trip not found" });

      const busTypeId = Number(trip.busTypeId ?? trip.busType?.id);
      const seat = await prisma.seat.findUnique({
        where: { id: Number(seatId) },
      });
      if (!seat || seat.busTypeId !== busTypeId) {
        return res
          .status(400)
          .json({ message: "Seat does not belong to trip's bus type" });
      }

      // تأكد أنه غير محجوز لنفس الرحلة
      const exists = await prisma.reservation.findFirst({
        where: { trip: { id: tripId }, seat: { id: Number(seatId) } },
      });
      if (exists)
        return res
          .status(409)
          .json({ message: "Seat already reserved for this trip" });

      seatConnect = { connect: { id: Number(seatId) } };
    }

    const reservation = await prisma.reservation.create({
      data: {
        trip: { connect: { id: tripId } },
        seat: seatConnect,
        passengerName,
        paid: false,
        amount: 0,
        creator: { connect: { id: uid } },
      },
    });

    res.status(201).json(toJSON(reservation));
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to add passenger", error: e.message });
  }
}

const fonts = {
  Arabic: {
    normal: path.join(__dirname, "..", "assets", "fonts", "Cairo.ttf"),
    bold: path.join(__dirname, "..", "assets", "fonts", "Cairo.ttf"),
    italics: path.join(__dirname, "..", "assets", "fonts", "Cairo.ttf"),
    bolditalics: path.join(__dirname, "..", "assets", "fonts", "Cairo.ttf"),
  },
};



// GET /api/ops/trips/:tripId/report.pdf
const printer = new PdfPrinter(fonts);
//  async function generateTripReportPDF(req, res) {
//   try {
//     const { tripId, userId } = req.body;

//     // تحقق من صلاحية المستخدم
//     const user = await prisma.user.findUnique({
//       where: { id: Number(userId) },
//     });
//     if (!user || user.role !== "ops") {
//       return res
//         .status(403)
//         .json({ error: "Only ops users can view trip reports" });
//     }

//     // جلب بيانات الرحلة
//     const trip = await prisma.trip.findUnique({
//       where: { id: BigInt(tripId) },
//       select: {
//         originLabel: true,
//         destinationLabel: true,
//         driverName: true,
//         departureDt: true,
//         reservations: {
//           select: {
//             passengerName: true,
//             amount: true,
//             boardingPoint: true,
//           },
//         },
//       },
//     });

//     if (!trip) return res.status(404).json({ error: "Trip not found" });

//     // احصاءات
//     const byAmount = {};
//     trip.reservations.forEach((r) => {
//       const amt = Number(r.amount); // تحويل Decimal إلى number
//       if (!byAmount[amt]) byAmount[amt] = 0;
//       byAmount[amt] += 1;
//     });

//     const byProvince = {}; // إضافة هذا الجزء
//     trip.reservations.forEach((r) => {
//       const province = r.boardingPoint || "غير محدد";
//       if (!byProvince[province]) byProvince[province] = 0;
//       byProvince[province] += 1;
//     });

//     // تعريف محتوى التقرير
//     const docDefinition = {
//       content: [
//         { text: " الرحلة تقرير ", style: "header", alignment: "center" },
//         { text: "\n" },

//         // معلومات الرحلة
//         {
//           columns: [
//             {
//               text: `${trip.destinationLabel || "غير محدد"} : إلى`,
//               alignment: "right",
//             },
//             {
//               text: `${trip.originLabel || "غير محدد"} : من`,
//               alignment: "right",
//             },
//           ],
//           margin: [0, 2, 0, 2],
//         },
//         {
//           text: `${trip.driverName || "غير محدد"} : السائق `,
//           alignment: "right",
//           margin: [0, 2, 0, 2],
//         },
//         {
//           text: `${trip.departureDt || "غير محدد"} : الرحلة تاريخ`,
//           alignment: "right",
//           margin: [0, 2, 0, 2],
//         },
//         {
//           text: `${trip.reservations.length || 0} : الركاب إجمالي `,
//           alignment: "right",
//           margin: [0, 2, 0, 10],
//         },

//         // جدول الركاب حسب المحافظة
//         {
//           text: "  المحافظة حسب الركاب عدد ",
//           style: "subheader",
//           alignment: "center",
//           margin: [0, 5, 0, 5],
//         },
//         {
//           table: {
//             headerRows: 1,
//             widths: ["*", "*"],
//             body: [
//               ["المحافظة", "الركاب عدد "],
//               ...Object.entries(byProvince).map(([prov, count]) => [
//                 prov,
//                 count,
//               ]),
//             ],
//           },
//           layout: "lightHorizontalLines",
//           margin: [0, 0, 0, 10],
//         },

//         // جدول الركاب حسب المبلغ المدفوع
//         {
//           text: " المدفوع المبلغ حسب الركاب عدد ",
//           style: "subheader",
//           alignment: "center",
//           margin: [0, 5, 0, 5],
//         },
//         {
//           table: {
//             headerRows: 1,
//             widths: ["*", "*"],
//             body: [
//               ["المدفوع المبلغ ", "الركاب عدد "],
//               ...Object.entries(byAmount).map(([amount, count]) => [
//                 amount,
//                 count,
//               ]),
//             ],
//           },
//           layout: "lightHorizontalLines",
//           margin: [0, 0, 0, 10],
//         },
//       ],

//       defaultStyle: {
//         font: "Arabic",
//         fontSize: 12,
//       },

//       styles: {
//         header: { fontSize: 18, bold: true },
//         subheader: { fontSize: 14, bold: true },
//       },
//     };

//     // إنشاء الـ PDF
//     const pdfDoc = printer.createPdfKitDocument(docDefinition);
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=trip_${tripId}_report.pdf`
//     );
//     pdfDoc.pipe(res);
//     pdfDoc.end();
//   } catch (err) {
//     console.error("Error generating trip PDF:", err);
//     res.status(500).json({ error: "Failed to generate trip PDF" });
//   }
// }
// controllers/ops.js

async function generateTripReportPDF(req, res) {
  try {
    // 1) التحقق من التوكن والدور من الـ middleware
    // (verifyAccessToken يملأ req.user = { id, role })
    if (!req.user || !["ops", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only ops users can view trip reports" });
    }

    // 2) جلب tripId من الـ params (وليس من الـ body)
    const rawTripId = req.params.tripId ?? req.body.tripId;
    if (!rawTripId) {
      return res.status(400).json({ error: "tripId is required (in route param)" });
    }
    let tripId;
    try { tripId = BigInt(rawTripId); } catch { return res.status(400).json({ error: "Invalid tripId" }); }

    // 3) جلب بيانات الرحلة
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        originLabel: true,
        destinationLabel: true,
        driverName: true,
        departureDt: true,
        reservations: {
          select: {
            passengerName: true,
            amount: true,        // Decimal
            boardingPoint: true, // "المحافظة/مكان الصعود"
          },
        },
      },
    });

    if (!trip) return res.status(404).json({ error: "Trip not found" });

    // 4) الإحصاءات
    const byAmount = {};
    const byProvince = {};

    for (const r of trip.reservations) {
      const amt = Number(r.amount || 0);
      byAmount[amt] = (byAmount[amt] || 0) + 1;

      const prov = r.boardingPoint || "غير محدد";
      byProvince[prov] = (byProvince[prov] || 0) + 1;
    }

    // 5) تعريف محتوى التقرير pdfmake
    const depStr = trip.departureDt ? new Date(trip.departureDt).toLocaleString("ar-SY") : "غير محدد";

    const docDefinition = {
      content: [
        { text: "الرحلة تقرير ", style: "header", alignment: "center" },
        { text: "\n" },

        // معلومات الرحلة
        {
          columns: [
            {
              text: `${trip.destinationLabel || "غير محدد"} : إلى`,
              alignment: "right",
            },
            {
              text: `${trip.originLabel || "غير محدد"} : من`,
              alignment: "right",
            },
          ],
          margin: [0, 2, 0, 2],
        },
        {
          text: `${trip.driverName || "غير محدد"} : السائق`,
          alignment: "right",
          margin: [0, 2, 0, 2],
        },
        {
          text: `${depStr} :  الرحلة تاريخ `,
          alignment: "right",
          margin: [0, 2, 0, 2],
        },
        {
          text: `${trip.reservations.length || 0} : الركاب إجمالي `,
          alignment: "right",
          margin: [0, 2, 0, 10],
        },

        // جدول الركاب حسب المحافظة
        {
          text: " المحافظة حسب الركاب عدد ",
          style: "subheader",
          alignment: "center",
          margin: [0, 5, 0, 5],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", "*"],
            body: [
              ["المحافظة", "الركاب عدد "],
              ...Object.entries(byProvince).map(([prov, count]) => [
                prov,
                count,
              ]),
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        },

        // جدول الركاب حسب المبلغ المدفوع
        {
          text: "المدفوع المبلغ حسب الركاب عدد",
          style: "subheader",
          alignment: "center",
          margin: [0, 5, 0, 5],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", "*"],
            body: [
              ["المبلغ", "الركاب عدد "],
              ...Object.entries(byAmount).map(([amount, count]) => [
                amount,
                count,
              ]),
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        },
      ],
      defaultStyle: {
        font: "Arabic",
        fontSize: 12,
      },
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, bold: true },
      },
    };

    // 6) إنشاء وإرسال الـ PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="trip_${rawTripId}_report.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("Error generating trip PDF:", err);
    res.status(500).json({ error: "Failed to generate trip PDF" });
  }
}


module.exports = {
  createTrip,
  updateTrip,
  deleteTrip,
  getTripPassengers,
  getTripPaymentsSummary,
  addPassenger,
  generateTripReportPDF,
};

