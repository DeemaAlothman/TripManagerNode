const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { toJSON } = require("../_utils");
const prisma = new PrismaClient();

const roles = ["admin", "booking", "security", "ops"];

async function createUser(req, res) {
  try {
    const { name, phone, role, password } = req.body;
    if (!name || !password || !roles.includes(role))
      return res
        .status(400)
        .json({ message: "Missing/invalid (name, role, password)" });

    if (phone) {
      const exists = await prisma.user.findFirst({ where: { phone } });
      if (exists)
        return res.status(409).json({ message: "Phone already used" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, phone, role, passwordHash },
    });
    res.status(201).json({ message: "User created", user: toJSON(user) });
  } catch (e) {
    res.status(500).json({ message: "Error creating user", error: e.message });
  }
}

async function listUsers(req, res) {
  try {
    const { q, role, page = "1", pageSize = "25" } = req.query;
    const take = Math.min(parseInt(pageSize) || 25, 100);
    const skip = (parseInt(page) - 1) * take;

    const where = {};
    if (role) where.role = role;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      total,
      page: Number(page),
      pageSize: take,
      items: toJSON(items),
    });
  } catch (e) {
    res.status(500).json({ message: "Error listing users", error: e.message });
  }
}

async function getUser(req, res) {
  try {
    const id = BigInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(toJSON(user));
  } catch (e) {
    res.status(500).json({ message: "Error fetching user", error: e.message });
  }
}

async function updateUser(req, res) {
  try {
    const id = BigInt(req.params.id);
    const { name, phone, role } = req.body;

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
    if (role !== undefined) data.role = role;

    const user = await prisma.user.update({ where: { id }, data });
    res.json({ message: "User updated", user: toJSON(user) });
  } catch (e) {
    res.status(500).json({ message: "Error updating user", error: e.message });
  }
}

async function resetPassword(req, res) {
  try {
    const id = BigInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword)
      return res.status(400).json({ message: "newPassword required" });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    res.json({ message: "Password reset" });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Error resetting password", error: e.message });
  }
}

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  resetPassword,
};
