const express = require("express");
const router = express.Router();

const security = require("../controllers/security");
const {
  verifyAccessToken,
  checkRole,
} = require("../controllers/middleware/auth");

/** 🔓 مسارات عامة (مفتوحة للـ admin والـ security) */
router.get("/security-logs", security.listSecurityLoging);
router.get("/security-logs/:id", security.getSecurityLoging);

// 🟢 alias لمسارات الأدمن عشان ما يفرق الكود بالفرونت
// router.get("/admin/security-logs", security.listSecurityLoging);
// router.get("/admin/security-logs/:id", security.getSecurityLoging);

/** 🔐 المسارات اللي بتحتاج كتابة/تعديل/حذف */
router.use(verifyAccessToken, checkRole(["security", "admin"]));

router.post("/logs", security.createSecurityLog);
router.patch("/logs/:id", security.updateSecurityLog);
router.delete("/logs/:id", security.deleteSecurityLog);

module.exports = router;
