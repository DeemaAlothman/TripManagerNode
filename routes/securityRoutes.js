// routes/securityRoutes.js
const express = require("express");
const router = express.Router();

const security = require("../controllers/security");
const {
  verifyAccessToken,
  checkRole,
} = require("../controllers/middleware/auth");

/** 🔓 مسارات عامة (للعرض فقط) */
router.get("/security-logs", security.listSecurityLogs);
router.get("/security-logs/:id", security.getSecurityLog);

/** 🔐 مسارات محمية (إنشاء/تعديل/حذف) */
router.use(verifyAccessToken, checkRole(["security", "admin"]));
router.post("/logs", security.createSecurityLog);
router.patch("/logs/:id", security.updateSecurityLog);
router.delete("/logs/:id", security.deleteSecurityLog);
router.get("/trips", security.getAllTrips);
module.exports = router;
