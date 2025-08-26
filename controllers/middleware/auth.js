const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");

function verifyAccessToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(403).json({
      message: "No access token provided",
      timestamp: new Date().toISOString(),
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      message: "Invalid access token",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function verifyRefreshToken(req, res, next) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(403).json({
      message: "No refresh token provided",
      timestamp: new Date().toISOString(),
    });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({
        message: "Invalid refresh token",
        timestamp: new Date().toISOString(),
      });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      message: "Invalid refresh token",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

function checkRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied: insufficient permissions",
        requiredRoles: allowedRoles,
        userRole: req.user?.role,
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
}

module.exports = { verifyAccessToken, verifyRefreshToken, checkRole };
