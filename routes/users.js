const express = require("express");
const { verifyAccessToken } = require("../controllers/middleware/auth");
const {
  getMe,
  updateMyProfile,
  changeMyPassword,
} = require("../controllers/users");

const router = express.Router();

// كل المسارات تتطلب توكن
router.use(verifyAccessToken);

// أنا: جلب بياناتي
router.get("/me", getMe);

// أنا: تعديل اسمي/هاتفي (الدور لا يُعدّل هنا)
router.patch("/me", updateMyProfile);

// أنا: تغيير كلمة السر (oldPassword + newPassword)
router.post("/me/change-password", changeMyPassword);

module.exports = router;
