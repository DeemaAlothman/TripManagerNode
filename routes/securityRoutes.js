const express = require("express");
const router = express.Router();
const {
  createSecurityLog,
  updateSecurityLog,
  deleteSecurityLog,
  listSecurityLogs,
} = require("../controllers/security");
const {
  verifyAccessToken,
  checkRole,
} = require("../controllers/middleware/auth");

// حماية كل مسارات الأمن
router.use(verifyAccessToken, checkRole(["security", "admin"]));

// RESTful routes
router.post("/logs", createSecurityLog);
router.patch("/logs/:id", updateSecurityLog);
router.delete("/logs/:id", deleteSecurityLog);
router.get("/logs", listSecurityLogs);

module.exports = router;
