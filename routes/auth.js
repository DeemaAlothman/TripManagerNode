const express = require("express");
const router = express.Router();
const { signup, login, refresh, logout } = require("../controllers/auth");
const {
  verifyAccessToken,
  verifyRefreshToken,
  checkRole,
} = require("../controllers/middleware/auth");

// افتحي signup بدون توكن بالبداية
router.post("/signup", signup);

// الباقي كما هو
router.post("/login", login);
router.post("/refresh", verifyRefreshToken, refresh);
router.post("/logout", verifyRefreshToken, logout);


module.exports = router;
