const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { toJSON, getUid } = require("./_utils");

const prisma = new PrismaClient();

// GET /api/users/me
async function getMe(req, res) {
  try {
    const id = getUid(req);
    const me = await prisma.user.findUnique({ where: { id } });
    if (!me) return res.status(404).json({ message: "User not found" });
    res.json(toJSON(me));
  } catch (e) {
    res.status(500).json({ message: "Error", error: e.message });
  }
}

// PATCH /api/users/me  { name?, phone? }
async function updateMyProfile(req, res) {
  try {
    const id = getUid(req);
    const { name, phone } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) {
      const exists = await prisma.user.findFirst({
        where: { phone, NOT: { id } },
      });
      if (exists)
        return res.status(409).json({ message: "Phone already used" });
      data.phone = phone;
    }

    const updated = await prisma.user.update({ where: { id }, data });
    res.json({ message: "Profile updated", user: toJSON(updated) });
  } catch (e) {
    res.status(500).json({ message: "Error", error: e.message });
  }
}

// POST /api/users/me/change-password  { oldPassword, newPassword }
async function changeMyPassword(req, res) {
  try {
    const id = getUid(req);
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "oldPassword & newPassword required" });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.passwordHash)
      return res.status(400).json({ message: "No password set" });

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Old password incorrect" });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    res.json({ message: "Password changed" });
  } catch (e) {
    res.status(500).json({ message: "Error", error: e.message });
  }
}

module.exports = { getMe, updateMyProfile, changeMyPassword };
