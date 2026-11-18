require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./src/config/db");

const servicesRouter = require("./src/routes/services");
const bookingsRouter = require("./src/routes/bookings");
const paymentsRouter = require("./src/routes/payments");
const adminRouter = require("./src/routes/admin");
const usersRouter = require("./src/routes/users");

const app = express();

// Allowed origins: local dev + whatever CLIENT_URL says (comma separated works too).
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, health checks) with no origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Keep the raw body around so the Stripe webhook can verify its signature.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get("/", (req, res) => {
  res.json({ message: "FixMate API is running." });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize before any database-backed route, including serverless invocations.
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: "Database connection failed." });
  }
});

app.use("/api/services", servicesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);

// Catch-all for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;

// Only bind a port when running directly (not when Vercel imports the app).
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`FixMate server running on port ${PORT}`),
      );
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err);
      process.exit(1);
    });
}

module.exports = app;
