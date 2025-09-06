const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const securityRoutes = require("./routes/securityRoutes");

dotenv.config();

const app = express();

// إعدادات الأمان مع helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // للتطوير، عدّل في الإنتاج
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

// دعم CORS للسماح بالفرونتند (للتطوير)
app.use(
  cors({
    origin: "http://localhost:5173", // أصل الفرونتند
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PUTCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // إذا كنت تستخدم cookies أو توكنات
  })
);

app.use(express.json());

// Middleware للتحقق من التوكن (باستثناء تسجيل الدخول والتسجيل)
const { verifyAccessToken } = require("./controllers/middleware/auth");
app.use((req, res, next) => {
  if (
    ["/api/auth/signup", "/api/auth/login", "/api/health"].includes(req.path)
  ) {
    return next();
  }
  verifyAccessToken(req, res, next); // إضافة التحقق للمسارات الأخرى
});

// تسجيل المسارات
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/security", securityRoutes);

// مسارات إضافية (تحقق من وجودها أولاً)
const userRoutes = require("./routes/users");
const bookingRoutes = require("./routes/booking");
const opsRoutes = require("./routes/ops");

app.use("/api/users", userRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/ops", opsRoutes);

app.get("/api/health", () => {
  return {
    status: "ok",
  };
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT} at ${new Date().toISOString()}`)
);
