const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

// Run the actual route handlers with an in-memory collection, without credentials.
function fixture(status, owner = "tech@fixmate.com", matchedCount = 1) {
  const booking = {
    _id: "booking-1",
    status,
    technicianEmail: owner,
    customerEmail: "customer@fixmate.com",
    statusHistory: [],
  };
  let update;
  const routes = {};
  const collection = {
    async findOne() {
      return booking;
    },
    async updateOne(filter, operation) {
      assert.ok(
        Object.keys(operation).every((key) => key.startsWith("$")),
        "MongoDB updates must use operators only",
      );
      update = { filter, operation };
      if (matchedCount) {
        Object.assign(booking, operation.$set);
        booking.statusHistory.push(operation.$push.statusHistory);
      }
      return { matchedCount };
    },
  };
  const router = {};
  for (const method of ["get", "post", "patch"])
    router[method] = (route, ...handlers) => {
      routes[`${method} ${route}`] = handlers.at(-1);
    };
  const context = {
    module: { exports: {} },
    console,
    require(name) {
      if (name === "express") return { Router: () => router };
      if (name === "mongodb") return { ObjectId: class {} };
      if (name === "../config/db")
        return { getDB: () => ({ collection: () => collection }) };
      if (name === "../middlewares/auth")
        return {
          verifyToken() {},
          verifyCustomer() {},
          verifyTechnician() {},
          findById: async () => booking,
        };
      throw new Error(`Unexpected dependency ${name}`);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src/routes/bookings.js"), "utf8"),
    context,
  );
  async function run(nextStatus, finalAmount) {
    const req = {
      params: { id: booking._id },
      user: { email: "tech@fixmate.com" },
      body: { status: nextStatus, finalAmount },
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await routes["patch /:id/status"](req, res);
    return res;
  }
  return { run, booking, getUpdate: () => update };
}

for (const [from, to] of [
  ["requested", "accepted"],
  ["requested", "rejected"],
  ["accepted", "in-progress"],
  ["in-progress", "completed"],
]) {
  test(`allows ${from} → ${to} and appends history`, async () => {
    const f = fixture(from);
    const res = await f.run(to, 45.5);
    assert.equal(res.statusCode, 200);
    assert.equal(f.booking.status, to);
    assert.equal(f.booking.statusHistory[0].status, to);
    assert.equal(f.getUpdate().filter.status, from);
    if (to === "completed") assert.equal(f.booking.finalAmount, 45.5);
  });
}
for (const [from, to] of [
  ["requested", "completed"],
  ["accepted", "requested"],
  ["completed", "accepted"],
  ["rejected", "accepted"],
  ["cancelled", "in-progress"],
]) {
  test(`rejects ${from} → ${to}`, async () => {
    assert.equal((await fixture(from).run(to, 30)).statusCode, 400);
  });
}
for (const amount of [undefined, 0, -1, "invalid", Infinity]) {
  test(`completion rejects invalid final amount ${amount}`, async () => {
    assert.equal(
      (await fixture("in-progress").run("completed", amount)).statusCode,
      400,
    );
  });
}
test("technician cannot modify another technician’s job", async () => {
  assert.equal(
    (await fixture("requested", "other@fixmate.com").run("accepted"))
      .statusCode,
    403,
  );
});
test("stale status update returns a conflict", async () => {
  assert.equal(
    (await fixture("requested", undefined, 0).run("accepted")).statusCode,
    409,
  );
});
