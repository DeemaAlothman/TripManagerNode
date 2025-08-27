const express = require("express");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const helmet = require("helmet");

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json());

// استثناء مسارات /api/auth/signup و/api/auth/login من أي تحقق محتمل للرمز
app.use((req, res, next) => {
  if (["/api/auth/signup", "/api/auth/login"].includes(req.path)) {
    return next();
  }
  // يمكن إضافة وسيط verifyAccessToken هنا للمسارات الأخرى إذا لزم الأمر
  next();
});

app.use("/api/auth", authRoutes);


app.use("/api/admin", require("./routes/admin"));

// users (لو عندك)
app.use("/api/users", require("./routes/users"));

app.use("/api/booking", require("./routes/booking"));

app.listen(3000, () =>
  console.log("Server running on port 3000 at", new Date().toISOString())
);



