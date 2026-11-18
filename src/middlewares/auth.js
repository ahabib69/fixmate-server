const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

// BetterAuth stores users in the `user` collection.
// We always re-read the role from the DB so admin role changes apply right away,
// even if the JWT was signed before the change.
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (typeof decoded.email !== "string")
      return res.status(401).json({ message: "Invalid token identity." });
    const db = getDB();

    const user = await db.collection("user").findOne({ email: decoded.email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    req.user = {
      email: user.email,
      role: user.role || "customer",
      name: user.name,
      userId: user._id.toString(),
    };

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Invalid or expired token. Please log in again." });
  }
}

function verifyCustomer(req, res, next) {
  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Forbidden. Customers only." });
  }
  next();
}

function verifyTechnician(req, res, next) {
  if (req.user.role !== "technician") {
    return res.status(403).json({ message: "Forbidden. Technicians only." });
  }
  next();
}

function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden. Admins only." });
  }
  next();
}

// Helper used by routes that take an :id param.
// BetterAuth ids can be stored as ObjectId or plain string depending on setup,
// so try both before giving up.
async function findById(collection, id) {
  if (typeof id !== "string" || !id.trim()) return null;
  let oid = null;
  try {
    oid = new ObjectId(id);
  } catch (_) {
    oid = null;
  }

  if (oid) {
    const byOid = await collection.findOne({ _id: oid });
    if (byOid) return byOid;
  }

  const byString = await collection.findOne({ _id: id });
  if (byString) return byString;

  // Some setups also keep a separate `id` field
  return collection.findOne({ id });
}

module.exports = {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
  verifyAdmin,
  findById,
};
