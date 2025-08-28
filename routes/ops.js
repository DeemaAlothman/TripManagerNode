// routes/ops.js
const express = require("express");
const router = express.Router();

const {
  createTrip,
  updateTrip,
  deleteTrip,
  getTripPassengers,
  getTripPaymentsSummary,
  addPassenger,
  generateTripReportPDF,
} = require("../controllers/ops");

const {
  verifyAccessToken,
  checkRole,
} = require("../controllers/middleware/auth");

// حماية جميع مسارات متسيّر الرحلات
router.use(verifyAccessToken, checkRole(["ops", "admin"]));

// رحلات
router.post("/trips", createTrip);
router.patch("/trips/:tripId", updateTrip);
router.delete("/trips/:tripId", deleteTrip);

// ركاب الرحلة وملخص المدفوعات
router.get("/trips/:tripId/passengers", getTripPassengers);
router.get("/trips/:tripId/payments-summary", getTripPaymentsSummary);

// إضافة راكب (اسم فقط، بدون دفع/صعود)
router.post("/trips/:tripId/passengers", addPassenger);

// تقرير PDF

router.get("/trips/:tripId/report.pdf", generateTripReportPDF);

module.exports = router;
