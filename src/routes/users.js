const express = require("express");
const { getDB } = require("../config/db");
const { verifyToken } = require("../middlewares/auth");

const router = express.Router();
const { validImage } = require("../utils/validation");

// Any logged-in user can update their own profile. Email and role stay read-only.
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { name, phone, area, bio, image } = req.body;

    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim().length < 2)
    ) {
      return res
        .status(400)
        .json({ message: "Name must contain at least 2 characters." });
    }
    if (image !== undefined && image !== null && !validImage(image)) {
      return res
        .status(400)
        .json({ message: "Please upload a valid profile image." });
    }
    const updates = { updatedAt: new Date() };
    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (area !== undefined) updates.area = String(area).trim();
    if (bio !== undefined) updates.bio = String(bio).trim();
    if (image !== undefined) updates.image = image;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nothing to update." });
    }

    await db
      .collection("user")
      .updateOne({ email: req.user.email }, { $set: updates });

    const updated = await db
      .collection("user")
      .findOne({ email: req.user.email });
    const { password, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile." });
  }
});

module.exports = router;
