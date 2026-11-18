const express = require("express");
const Stripe = require("stripe");
const { getDB } = require("../config/db");
const {
  verifyToken,
  verifyCustomer,
  findById,
} = require("../middlewares/auth");
const { handleSuccessfulPayment } = require("../utils/paymentHandler");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Customer's own payments
router.get("/my", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const payments = await db
      .collection("payments")
      .find({ customerEmail: req.user.email })
      .sort({ paidAt: -1 })
      .toArray();
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load payments." });
  }
});

// Create a Stripe Checkout session for a completed, unpaid booking.
// The amount always comes from the DB, never from the client.
router.post(
  "/create-checkout-session",
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const db = getDB();
      const { bookingId } = req.body;

      if (!bookingId) {
        return res.status(400).json({ message: "Booking id is required." });
      }

      const booking = await findById(db.collection("bookings"), bookingId);
      if (!booking)
        return res.status(404).json({ message: "Booking not found." });
      if (booking.customerEmail !== req.user.email) {
        return res
          .status(403)
          .json({ message: "You can only pay for your own bookings." });
      }
      if (
        booking.status !== "completed" ||
        booking.paymentStatus !== "unpaid"
      ) {
        return res
          .status(400)
          .json({ message: "This booking is not ready for payment." });
      }

      const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000")
        .split(",")[0]
        .trim()
        .replace(/\/$/, "");

      if (
        !Number.isFinite(Number(booking.finalAmount)) ||
        Number(booking.finalAmount) <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Booking final amount is invalid." });
      }
      let checkoutVersion = booking.checkoutVersion || 0;
      if (booking.checkoutSessionId) {
        const previous = await stripe.checkout.sessions.retrieve(
          booking.checkoutSessionId,
        );
        if (previous.status === "open")
          return res.json({ url: previous.url, id: previous.id });
        if (previous.status === "complete") {
          if (previous.payment_status === "paid")
            await handleSuccessfulPayment(previous);
          return res.status(409).json({
            message:
              "This checkout is already completed. Refresh your bookings.",
          });
        }
        const changed = await db.collection("bookings").updateOne(
          {
            _id: booking._id,
            checkoutSessionId: booking.checkoutSessionId,
            paymentStatus: "unpaid",
          },
          { $inc: { checkoutVersion: 1 }, $unset: { checkoutSessionId: "" } },
        );
        if (!changed.matchedCount)
          return res
            .status(409)
            .json({ message: "Checkout changed. Please try again." });
        checkoutVersion += 1;
      }

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: booking.serviceTitle },
                unit_amount: Math.round(Number(booking.finalAmount) * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            bookingId: booking._id.toString(),
            customerEmail: booking.customerEmail,
          },
          success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientUrl}/payment/cancel`,
        },
        {
          idempotencyKey: `booking:${booking._id}:checkout:${checkoutVersion}`,
        },
      );
      await db
        .collection("bookings")
        .updateOne(
          { _id: booking._id, paymentStatus: "unpaid" },
          { $set: { checkoutSessionId: session.id } },
        );

      res.json({ url: session.url, id: session.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create checkout session." });
    }
  },
);

// Verify a session from the success page. Safe to call more than once.
router.get("/verify", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ message: "session_id is required." });
    }

    const session = await stripe.checkout.sessions.retrieve(String(session_id));
    const booking = await findById(
      getDB().collection("bookings"),
      session.metadata?.bookingId,
    );
    if (!booking || booking.customerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only verify your own payments." });
    }

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment is not completed yet." });
    }

    const payment = await handleSuccessfulPayment(session);
    res.json({ message: "Payment verified.", payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify payment." });
  }
});

// Stripe webhook - needs the raw body, signature checked with the webhook secret.
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    try {
      await handleSuccessfulPayment(event.data.object);
    } catch (err) {
      console.error("Failed to record payment from webhook:", err);
      return res.status(500).send("Failed to record payment.");
    }
  }

  res.json({ received: true });
});

module.exports = router;
