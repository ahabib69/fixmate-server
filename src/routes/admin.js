const express = require("express");
const { getDB } = require("../config/db");
const { verifyToken, verifyAdmin, findById } = require("../middlewares/auth");

const router = express.Router();

// All routes here need an admin token.
router.use(verifyToken, verifyAdmin);

// ---- Users ----
router.get("/users", async (req, res) => {
  try {
    const db = getDB();
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      const regex = new RegExp(req.query.search.trim(), "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const users = await db
      .collection("user")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    // Never send password material back to the client.
    const safe = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });

    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load users." });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const db = getDB();
    const { role } = req.body;

    if (!["customer", "technician", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Role must be customer, technician or admin." });
    }

    const target = await findById(db.collection("user"), req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    // An admin can never change their own role.
    if (target.email === req.user.email) {
      return res
        .status(400)
        .json({ message: "You cannot change your own role." });
    }

    await db
      .collection("user")
      .updateOne({ _id: target._id }, { $set: { role } });
    const updated = await db.collection("user").findOne({ _id: target._id });
    const { password, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update role." });
  }
});

// ---- Services ----
router.get("/services", async (req, res) => {
  try {
    const db = getDB();
    const filter = {};
    if (req.query.approvalStatus)
      filter.approvalStatus = req.query.approvalStatus;

    const services = await db.collection("services").find(filter).toArray();

    // Pending first, then newest.
    const order = { pending: 0, approved: 1, rejected: 2 };
    services.sort((a, b) => {
      const diff =
        (order[a.approvalStatus] ?? 3) - (order[b.approvalStatus] ?? 3);
      if (diff !== 0) return diff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load services." });
  }
});

router.patch("/services/:id/approval", async (req, res) => {
  try {
    const db = getDB();
    const { approvalStatus } = req.body;

    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res
        .status(400)
        .json({ message: "approvalStatus must be approved or rejected." });
    }

    const service = await findById(db.collection("services"), req.params.id);
    if (!service)
      return res.status(404).json({ message: "Service not found." });

    await db
      .collection("services")
      .updateOne({ _id: service._id }, { $set: { approvalStatus } });
    const updated = await db
      .collection("services")
      .findOne({ _id: service._id });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update approval status." });
  }
});

// ---- Bookings ----
router.get("/bookings", async (req, res) => {
  try {
    const db = getDB();
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const bookings = await db
      .collection("bookings")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load bookings." });
  }
});

// ---- Payments ----
router.get("/payments", async (req, res) => {
  try {
    const db = getDB();
    const payments = await db
      .collection("payments")
      .find({})
      .sort({ paidAt: -1 })
      .toArray();

    const totalRevenue = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );
    res.json({ payments, totalRevenue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load payments." });
  }
});

// ---- Stats for the admin dashboard ----
router.get("/stats", async (req, res) => {
  try {
    const db = getDB();

    const [
      totalUsers,
      totalTechnicians,
      totalCustomers,
      totalServices,
      pendingServices,
      approvedServices,
      totalBookings,
      completedBookings,
    ] = await Promise.all([
      db.collection("user").countDocuments({}),
      db.collection("user").countDocuments({ role: "technician" }),
      db.collection("user").countDocuments({ role: "customer" }),
      db.collection("services").countDocuments({}),
      db.collection("services").countDocuments({ approvalStatus: "pending" }),
      db.collection("services").countDocuments({ approvalStatus: "approved" }),
      db.collection("bookings").countDocuments({}),
      db.collection("bookings").countDocuments({ status: "completed" }),
    ]);

    const payments = await db.collection("payments").find({}).toArray();
    const totalRevenue = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    const bookingsByStatus = await db
      .collection("bookings")
      .aggregate([{ $group: { _id: "$status", value: { $sum: 1 } } }])
      .toArray();

    const servicesByCategory = await db
      .collection("services")
      .aggregate([{ $group: { _id: "$category", value: { $sum: 1 } } }])
      .toArray();

    // Revenue per month for the chart
    const revenueByMonth = await db
      .collection("payments")
      .aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.json({
      totalUsers,
      totalTechnicians,
      totalCustomers,
      totalServices,
      pendingServices,
      approvedServices,
      totalBookings,
      completedBookings,
      totalRevenue,
      bookingsByStatus: bookingsByStatus.map((b) => ({
        name: b._id,
        value: b.value,
      })),
      servicesByCategory: servicesByCategory.map((s) => ({
        name: s._id,
        value: s.value,
      })),
      revenueByMonth: revenueByMonth.map((r) => ({
        name: r._id,
        revenue: r.revenue,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stats." });
  }
});

module.exports = router;
