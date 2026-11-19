const express = require("express");
const { getDB } = require("../config/db");
const {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
  findById,
} = require("../middlewares/auth");

const router = express.Router();

const ACTIVE_STATUSES = ["requested", "accepted", "in-progress"];

// Only these moves are allowed. Anything else is a 400.
const ALLOWED_TRANSITIONS = {
  requested: ["accepted", "rejected"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
};

// Customer creates a repair request
router.post("/", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const {
      serviceId,
      customerPhone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    if (
      !serviceId ||
      !customerPhone ||
      !address ||
      !preferredDate ||
      !problemDescription
    ) {
      return res
        .status(400)
        .json({ message: "Please fill in all required fields." });
    }
    if (String(problemDescription).trim().length < 20) {
      return res.status(400).json({
        message: "Problem description must be at least 20 characters.",
      });
    }

    const date = new Date(preferredDate);
    if (!Number.isFinite(date.getTime())) {
      return res
        .status(400)
        .json({ message: "Please provide a valid preferred date." });
    }
    // Allow one day of slack so every timezone works, but reject clearly past dates.
    const earliest = new Date();
    earliest.setUTCHours(0, 0, 0, 0);
    earliest.setUTCDate(earliest.getUTCDate() - 1);
    if (date < earliest) {
      return res
        .status(400)
        .json({ message: "Preferred date cannot be in the past." });
    }
    if (
      ![customerPhone, address, problemDescription].every(
        (value) => typeof value === "string" && value.trim(),
      )
    ) {
      return res
        .status(400)
        .json({ message: "Please fill in all required fields." });
    }

    const service = await findById(db.collection("services"), serviceId);
    if (
      !service ||
      service.approvalStatus !== "approved" ||
      service.isAvailable !== true
    ) {
      return res.status(404).json({ message: "Service not found." });
    }

    // A technician can never request their own service.
    if (service.technicianEmail === req.user.email) {
      return res
        .status(403)
        .json({ message: "You cannot request your own service." });
    }

    // One active request per customer per service.
    const duplicate = await db.collection("bookings").findOne({
      serviceId: service._id,
      customerEmail: req.user.email,
      status: { $in: ACTIVE_STATUSES },
    });
    if (duplicate) {
      return res.status(409).json({
        message: "You already have an active request for this service",
      });
    }

    const user = await db.collection("user").findOne({ email: req.user.email });

    const booking = {
      serviceId: service._id,
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: user ? user.name : req.user.name,
      customerEmail: req.user.email,
      customerPhone: String(customerPhone).trim(),
      address: String(address).trim(),
      preferredDate: new Date(preferredDate),
      problemDescription: String(problemDescription).trim(),
      status: "requested",
      finalAmount: service.basePrice,
      paymentStatus: "unpaid",
      statusHistory: [{ status: "requested", changedAt: new Date() }],
      createdAt: new Date(),
    };

    const result = await db.collection("bookings").insertOne(booking);
    res.status(201).json({ ...booking, _id: result.insertedId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "You already have an active request for this service",
      });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to send repair request." });
  }
});

// Customer's own bookings
router.get("/my", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const filter = { customerEmail: req.user.email };
    if (req.query.status) filter.status = req.query.status;

    const bookings = await db
      .collection("bookings")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your bookings." });
  }
});

// Technician stats for the dashboard
router.get(
  "/technician/stats",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const db = getDB();
      const email = req.user.email;

      const [
        totalServices,
        approvedServices,
        totalRequests,
        pendingRequests,
        completedJobs,
      ] = await Promise.all([
        db.collection("services").countDocuments({ technicianEmail: email }),
        db.collection("services").countDocuments({
          technicianEmail: email,
          approvalStatus: "approved",
        }),
        db.collection("bookings").countDocuments({ technicianEmail: email }),
        db
          .collection("bookings")
          .countDocuments({ technicianEmail: email, status: "requested" }),
        db
          .collection("bookings")
          .countDocuments({ technicianEmail: email, status: "completed" }),
      ]);

      const statusAgg = await db
        .collection("bookings")
        .aggregate([
          { $match: { technicianEmail: email } },
          { $group: { _id: "$status", value: { $sum: 1 } } },
        ])
        .toArray();

      const statusBreakdown = statusAgg.map((s) => ({
        name: s._id,
        value: s.value,
      }));

      const paidAgg = await db
        .collection("payments")
        .aggregate([
          { $match: { technicianEmail: email } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray();
      const totalEarnings = paidAgg.length ? paidAgg[0].total : 0;

      res.json({
        totalServices,
        approvedServices,
        pendingRequests,
        totalRequests,
        completedJobs,
        totalEarnings,
        statusBreakdown,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load stats." });
    }
  },
);

// Technician's incoming requests
router.get("/technician", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const filter = { technicianEmail: req.user.email };
    if (req.query.status) filter.status = req.query.status;

    const bookings = await db
      .collection("bookings")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load requests." });
  }
});

// Customer cancels their own request (only while still `requested`)
router.patch("/:id/cancel", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const booking = await findById(db.collection("bookings"), req.params.id);

    if (!booking)
      return res.status(404).json({ message: "Booking not found." });
    if (booking.customerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own requests." });
    }
    if (booking.status !== "requested") {
      return res.status(400).json({
        message: 'Only requests in "requested" status can be cancelled.',
      });
    }

    const result = await db.collection("bookings").updateOne(
      { _id: booking._id, status: "requested" },
      {
        $set: { status: "cancelled" },
        $push: {
          statusHistory: { status: "cancelled", changedAt: new Date() },
        },
      },
    );
    if (!result.matchedCount) {
      return res
        .status(409)
        .json({ message: "This booking changed. Refresh and try again." });
    }

    const updated = await db
      .collection("bookings")
      .findOne({ _id: booking._id });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to cancel request." });
  }
});

// Technician moves a job forward
router.patch("/:id/status", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const booking = await findById(db.collection("bookings"), req.params.id);

    if (!booking)
      return res.status(404).json({ message: "Booking not found." });
    if (booking.technicianEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only update your own jobs." });
    }

    const { status, finalAmount } = req.body;
    const allowed = ALLOWED_TRANSITIONS[booking.status] || [];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot move from "${booking.status}" to "${status}".`,
      });
    }

    const updates = {
      $push: { statusHistory: { status, changedAt: new Date() } },
    };

    if (status === "completed") {
      if (
        finalAmount === undefined ||
        !Number.isFinite(Number(finalAmount)) ||
        Number(finalAmount) <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Please provide a final amount greater than 0." });
      }
      updates.$set = { status, finalAmount: Number(finalAmount) };
    } else {
      updates.$set = { status };
    }

    const result = await db
      .collection("bookings")
      .updateOne({ _id: booking._id, status: booking.status }, updates);
    if (!result.matchedCount) {
      return res
        .status(409)
        .json({ message: "This booking changed. Refresh and try again." });
    }
    const updated = await db
      .collection("bookings")
      .findOne({ _id: booking._id });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update job status." });
  }
});

module.exports = router;
