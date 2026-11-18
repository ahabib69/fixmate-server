const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

// Safe for webhook retries and a success-page verification arriving together.
async function handleSuccessfulPayment(session) {
  const db = getDB();
  if (
    session.payment_status !== "paid" ||
    !ObjectId.isValid(session.metadata?.bookingId)
  ) {
    throw new Error(
      "A paid session with a valid booking reference is required.",
    );
  }
  const bookingId = new ObjectId(session.metadata.bookingId);
  const booking = await db.collection("bookings").findOne({ _id: bookingId });
  if (!booking) throw new Error("Booking not found.");
  if (
    booking.status !== "completed" ||
    session.metadata.customerEmail !== booking.customerEmail ||
    session.currency !== "usd" ||
    session.amount_total !== Math.round(Number(booking.finalAmount) * 100)
  ) {
    throw new Error("Payment does not match the completed booking.");
  }
  const payments = db.collection("payments");
  let payment = await payments.findOne({ bookingId });
  if (!payment) {
    payment = {
      bookingId,
      serviceTitle: booking.serviceTitle,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      technicianName: booking.technicianName,
      technicianEmail: booking.technicianEmail,
      amount: booking.finalAmount,
      currency: "usd",
      transactionId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      stripeSessionId: session.id,
      paymentStatus: "paid",
      paidAt: new Date(),
    };
    try {
      const result = await payments.insertOne(payment);
      payment._id = result.insertedId;
    } catch (err) {
      if (err.code !== 11000) throw err;
      payment = await payments.findOne({ bookingId });
      if (!payment) throw err;
    }
  }
  // Also repair a previous attempt that inserted a receipt but failed to update the booking.
  await db
    .collection("bookings")
    .updateOne({ _id: bookingId }, { $set: { paymentStatus: "paid" } });
  return payment;
}
module.exports = { handleSuccessfulPayment };
