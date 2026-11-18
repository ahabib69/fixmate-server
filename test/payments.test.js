const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function fixture(overrides = {}, sessionOverrides = {}) {
  const booking = {
    _id: "booking-1",
    customerEmail: "customer@fixmate.com",
    serviceTitle: "Laptop repair",
    finalAmount: 90,
    status: "completed",
    paymentStatus: "unpaid",
    ...overrides,
  };
  const session = {
    id: "cs_test_1",
    url: "https://checkout.stripe.com/test",
    status: "open",
    payment_status: "paid",
    metadata: { bookingId: "booking-1" },
    ...sessionOverrides,
  };
  const routes = {};
  let createCall;
  let recorded = 0;
  const router = {};
  for (const method of ["get", "post"])
    router[method] = (route, ...handlers) => {
      routes[`${method} ${route}`] = handlers.at(-1);
    };
  class Stripe {
    constructor() {
      this.checkout = {
        sessions: {
          async create(params, options) {
            createCall = { params, options };
            return session;
          },
          async retrieve() {
            return session;
          },
        },
      };
    }
  }
  const collection = {
    async updateOne() {
      return { matchedCount: 1 };
    },
  };
  const context = {
    module: { exports: {} },
    console,
    process: {
      env: { CLIENT_URL: "https://client.example,https://preview.example" },
    },
    require(name) {
      if (name === "express") return { Router: () => router };
      if (name === "stripe") return Stripe;
      if (name === "mongodb") return { ObjectId: class {} };
      if (name === "../config/db")
        return { getDB: () => ({ collection: () => collection }) };
      if (name === "../middlewares/auth")
        return {
          verifyToken() {},
          verifyCustomer() {},
          findById: async () => booking,
        };
      if (name === "../utils/paymentHandler")
        return {
          handleSuccessfulPayment: async () => {
            recorded++;
            return { amount: 90 };
          },
        };
      throw new Error(`Unexpected dependency ${name}`);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src/routes/payments.js"), "utf8"),
    context,
  );
  async function run(route, email = "customer@fixmate.com") {
    const req = {
      body: {
        bookingId: booking._id,
        amount: 0.01,
        customerEmail: "someone-else@fixmate.com",
      },
      query: { session_id: session.id },
      user: { email },
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
    await routes[route](req, res);
    return res;
  }
  return { run, getCreated: () => createCall, getRecorded: () => recorded };
}

test("checkout uses DB final amount, USD, ownership metadata and stable idempotency key", async () => {
  const f = fixture();
  const res = await f.run("post /create-checkout-session");
  assert.equal(res.statusCode, 200);
  const { params, options } = f.getCreated();
  assert.equal(params.line_items[0].price_data.unit_amount, 9000);
  assert.equal(params.line_items[0].price_data.currency, "usd");
  assert.equal(params.metadata.customerEmail, "customer@fixmate.com");
  assert.equal(
    params.success_url,
    "https://client.example/payment/success?session_id={CHECKOUT_SESSION_ID}",
  );
  assert.equal(options.idempotencyKey, "booking:booking-1:checkout:0");
});
test("checkout rejects a different customer", async () => {
  const f = fixture();
  assert.equal(
    (await f.run("post /create-checkout-session", "other@fixmate.com"))
      .statusCode,
    403,
  );
  assert.equal(f.getCreated(), undefined);
});
for (const status of ["requested", "accepted", "in-progress"]) {
  test(`checkout rejects ${status} job`, async () => {
    const f = fixture({ status });
    assert.equal(
      (await f.run("post /create-checkout-session")).statusCode,
      400,
    );
    assert.equal(f.getCreated(), undefined);
  });
}
test("checkout rejects a paid booking", async () => {
  const f = fixture({ paymentStatus: "paid" });
  assert.equal((await f.run("post /create-checkout-session")).statusCode, 400);
});
test("checkout reuses a stored open session", async () => {
  const f = fixture({ checkoutSessionId: "cs_test_1" });
  assert.equal((await f.run("post /create-checkout-session")).statusCode, 200);
  assert.equal(f.getCreated(), undefined);
});
test("verification rejects a different owner before recording", async () => {
  const f = fixture();
  assert.equal(
    (await f.run("get /verify", "other@fixmate.com")).statusCode,
    403,
  );
  assert.equal(f.getRecorded(), 0);
});
test("verification rejects unpaid Stripe session", async () => {
  const f = fixture({}, { payment_status: "unpaid" });
  assert.equal((await f.run("get /verify")).statusCode, 400);
  assert.equal(f.getRecorded(), 0);
});
test("verification records a paid session for its owner", async () => {
  const f = fixture();
  assert.equal((await f.run("get /verify")).statusCode, 200);
  assert.equal(f.getRecorded(), 1);
});
