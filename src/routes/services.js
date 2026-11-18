const express = require("express");
const { getDB } = require("../config/db");
const {
  verifyToken,
  verifyTechnician,
  findById,
} = require("../middlewares/auth");

const router = express.Router();
const { validateService } = require("../utils/validation");

// Public list - only approved + available services.
// Supports: ?search=&category=&serviceMode=&sort=price-asc|price-desc|newest&page=&limit=
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const { search, category, serviceMode, sort, page, limit } = req.query;

    const filter = { approvalStatus: "approved", isAvailable: true };

    if (category) filter.category = category;
    if (serviceMode) filter.serviceMode = serviceMode;

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ title: regex }, { category: regex }];
    }

    let sortObj = { createdAt: -1 };
    if (sort === "price-asc") sortObj = { basePrice: 1 };
    if (sort === "price-desc") sortObj = { basePrice: -1 };
    if (sort === "newest") sortObj = { createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const total = await db.collection("services").countDocuments(filter);
    const services = await db
      .collection("services")
      .find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      data: services,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load services." });
  }
});

// Latest 6 for the homepage. Must stay above /:id.
router.get("/latest", async (req, res) => {
  try {
    const db = getDB();
    const services = await db
      .collection("services")
      .find({ approvalStatus: "approved", isAvailable: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load latest services." });
  }
});

// Technician's own services
router.get("/mine", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const services = await db
      .collection("services")
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your services." });
  }
});

// Public detail - hidden unless approved + available
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const service = await findById(db.collection("services"), req.params.id);

    if (
      !service ||
      service.approvalStatus !== "approved" ||
      service.isAvailable !== true
    ) {
      return res.status(404).json({ message: "Service not found." });
    }

    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load service." });
  }
});

// Create a new service (technician)
router.post("/", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    const error = validateService(req.body);
    if (error) return res.status(400).json({ message: error });

    const user = await db.collection("user").findOne({ email: req.user.email });

    const service = {
      title: title.trim(),
      category,
      description: description.trim(),
      image,
      basePrice: Number(basePrice),
      estimatedDuration: String(estimatedDuration).trim(),
      serviceMode,
      serviceArea: String(serviceArea).trim(),
      technicianName: user ? user.name : req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: "pending",
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await db.collection("services").insertOne(service);
    res.status(201).json({ ...service, _id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create service." });
  }
});

// Edit own service - sending it back to pending for re-approval
router.patch("/:id", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const service = await findById(db.collection("services"), req.params.id);

    if (!service)
      return res.status(404).json({ message: "Service not found." });
    if (service.technicianEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only edit your own services." });
    }

    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    const error = validateService({ ...service, ...req.body });
    if (error) return res.status(400).json({ message: error });

    const updates = { approvalStatus: "pending" };
    if (title !== undefined) updates.title = String(title).trim();
    if (category !== undefined) updates.category = category;
    if (description !== undefined)
      updates.description = String(description).trim();
    if (image !== undefined) updates.image = image;
    if (basePrice !== undefined) updates.basePrice = Number(basePrice);
    if (estimatedDuration !== undefined)
      updates.estimatedDuration = String(estimatedDuration).trim();
    if (serviceMode !== undefined) updates.serviceMode = serviceMode;
    if (serviceArea !== undefined)
      updates.serviceArea = String(serviceArea).trim();

    await db
      .collection("services")
      .updateOne({ _id: service._id }, { $set: updates });
    const updated = await db
      .collection("services")
      .findOne({ _id: service._id });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update service." });
  }
});

// Delete own service
router.delete("/:id", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const service = await findById(db.collection("services"), req.params.id);

    if (!service)
      return res.status(404).json({ message: "Service not found." });
    if (service.technicianEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only delete your own services." });
    }

    await db.collection("services").deleteOne({ _id: service._id });
    res.json({ message: "Service deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete service." });
  }
});

// Toggle availability
router.patch(
  "/:id/availability",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const db = getDB();
      const service = await findById(db.collection("services"), req.params.id);

      if (!service)
        return res.status(404).json({ message: "Service not found." });
      if (service.technicianEmail !== req.user.email) {
        return res
          .status(403)
          .json({ message: "You can only update your own services." });
      }

      if (
        req.body.isAvailable !== undefined &&
        typeof req.body.isAvailable !== "boolean"
      ) {
        return res
          .status(400)
          .json({ message: "Availability must be true or false." });
      }
      const nextValue =
        req.body.isAvailable !== undefined
          ? Boolean(req.body.isAvailable)
          : !service.isAvailable;

      await db
        .collection("services")
        .updateOne({ _id: service._id }, { $set: { isAvailable: nextValue } });
      const updated = await db
        .collection("services")
        .findOne({ _id: service._id });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update availability." });
    }
  },
);

module.exports = router;
