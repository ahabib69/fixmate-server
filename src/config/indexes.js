async function ensureIndexes(db) {
  await db
    .collection("payments")
    .createIndex(
      { stripeSessionId: 1 },
      { unique: true, name: "stripeSessionId_unique" },
    );
  await db
    .collection("payments")
    .createIndex(
      { bookingId: 1 },
      { unique: true, name: "one_payment_per_booking" },
    );
  // The partial index releases the pair once a request reaches a terminal status.
  await db
    .collection("bookings")
    .createIndex(
      { customerEmail: 1, serviceId: 1 },
      {
        unique: true,
        name: "one_active_request",
        partialFilterExpression: {
          status: { $in: ["requested", "accepted", "in-progress"] },
        },
      },
    );
  await db.collection("user").createIndex({ email: 1 }, { unique: true });
  await db
    .collection("services")
    .createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 });
  await db
    .collection("bookings")
    .createIndex({ technicianEmail: 1, createdAt: -1 });
}
module.exports = { ensureIndexes };
