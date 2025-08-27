const express = require("express");
const {
  verifyAccessToken,
  checkRole,
} = require("../controllers/middleware/auth");
const booking = require("../controllers/booking");

const router = express.Router();

// 🔒 حماية كل المسارات لموظف الحجز المسبق (أو الأدمن)
router.use(verifyAccessToken, checkRole(["booking", "admin"]));

/* ========= TRIPS ========= */
router.post("/trips", booking.createTrip);
router.get("/trips", booking.listTrips);
router.get("/trips/:tripId", booking.getTrip);
router.patch("/trips/:tripId", booking.updateTrip); // اختياري للتعديل

/* ======= SEAT MAP (no hold/block) ======= */
router.get("/trips/:tripId/seat-map", booking.getSeatMap);
router.get("/trips/:tripId/seats/available", booking.getAvailableSeats); // اختياري

/* ========= RESERVATIONS ========= */
router.post("/reservations", booking.createReservation);
router.get("/trips/:tripId/reservations", booking.listTripReservations);
router.get("/reservations/:id", booking.getReservation);
router.patch("/reservations/:id", booking.updateReservation);
router.delete("/reservations/:id", booking.deleteReservation);

module.exports = router;
