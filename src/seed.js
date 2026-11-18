require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const { scrypt, randomBytes } = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(scrypt);

// Same hashing BetterAuth uses by default (scrypt N=16384, r=16, p=1,
// stored as "<salt hex>:<key hex>"), so seeded logins actually work.
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const normalized = password.normalize("NFKC");
  const derivedKey = await scryptAsync(normalized, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${derivedKey.toString("hex")}`;
}

const usersSeed = [
  {
    name: "Admin User",
    email: "admin@fixmate.com",
    password: "Admin123",
    role: "admin",
    phone: "+8801700000000",
    area: "Dhaka",
    bio: "FixMate platform admin.",
    image: "https://i.pravatar.cc/150?img=12",
  },
  {
    name: "Rahim Uddin",
    email: "rahim@fixmate.com",
    password: "Rahim123",
    role: "technician",
    phone: "+8801711111111",
    area: "Mirpur, Dhaka",
    bio: "Smartphone and laptop specialist with 6 years of experience. Fast screen and battery replacements with genuine parts.",
    image: "https://i.pravatar.cc/150?img=13",
  },
  {
    name: "Sara Akter",
    email: "sara@fixmate.com",
    password: "Sara123",
    role: "technician",
    phone: "+8801722222222",
    area: "GEC Circle, Chattogram",
    bio: "AC and refrigerator expert. Deep cleaning, gas refill and compressor repair at your doorstep.",
    image: "https://i.pravatar.cc/150?img=47",
  },
  {
    name: "Tanvir Hasan",
    email: "tanvir@fixmate.com",
    password: "Tanvir123",
    role: "technician",
    phone: "+8801733333333",
    area: "Uttara, Dhaka",
    bio: "TV, washing machine and home electrical technician. 8 years fixing all major brands.",
    image: "https://i.pravatar.cc/150?img=14",
  },
  {
    name: "Arif Chowdhury",
    email: "customer@fixmate.com",
    password: "Customer123",
    role: "customer",
    phone: "+8801744444444",
    area: "Dhanmondi, Dhaka",
    bio: "Regular FixMate customer.",
    image: "https://i.pravatar.cc/150?img=15",
  },
  {
    name: "Nusrat Jahan",
    email: "nusrat@fixmate.com",
    password: "Nusrat123",
    role: "customer",
    phone: "+8801755555555",
    area: "Agrabad, Chattogram",
    bio: "Homeowner in Chattogram.",
    image: "https://i.pravatar.cc/150?img=32",
  },
  {
    name: "Mehedi Hasan",
    email: "mehedi@fixmate.com",
    password: "Mehedi123",
    role: "customer",
    phone: "+8801766666666",
    area: "Banani, Dhaka",
    bio: "Small business owner.",
    image: "https://i.pravatar.cc/150?img=16",
  },
];

const servicesSeed = [
  {
    title: "Smartphone Screen Replacement",
    category: "Smartphone",
    description:
      "Cracked screen? We replace broken displays for Samsung, Xiaomi, Realme, iPhone and more with high-quality OLED/LCD panels. Includes free tempered glass and 30-day warranty. Most screens fixed within 45 minutes at your home.",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop",
    basePrice: 45,
    estimatedDuration: "45 mins",
    serviceMode: "Home Visit",
    serviceArea: "Mirpur, Dhaka",
    technicianEmail: "rahim@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Smartphone Battery & Charging Port Fix",
    category: "Smartphone",
    description:
      "Phone draining fast or not charging? We replace worn-out batteries and repair loose charging ports with original-quality parts. Tested before handover with health report.",
    image:
      "https://images.unsplash.com/photo-1592750475338-74cb14b21085?q=80&w=800&auto=format&fit=crop",
    basePrice: 25,
    estimatedDuration: "30 mins",
    serviceMode: "Shop Drop-off",
    serviceArea: "Mirpur, Dhaka",
    technicianEmail: "rahim@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Laptop Screen & Keyboard Repair",
    category: "Laptop & PC",
    description:
      "Broken laptop display or sticky keys? We replace screens and keyboards for HP, Dell, Lenovo, Asus and Apple laptops. Genuine-grade panels with brightness and color calibration.",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=800&auto=format&fit=crop",
    basePrice: 85,
    estimatedDuration: "2 hours",
    serviceMode: "Home Visit",
    serviceArea: "Mirpur, Dhaka",
    technicianEmail: "rahim@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Laptop Slow Performance & SSD Upgrade",
    category: "Laptop & PC",
    description:
      "Laptop taking forever to boot? We clean dust, replace HDD with fast SSD, upgrade RAM and reinstall Windows with all drivers. Your laptop will feel brand new.",
    image:
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=800&auto=format&fit=crop",
    basePrice: 60,
    estimatedDuration: "3 hours",
    serviceMode: "Shop Drop-off",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "AC Deep Cleaning & Gas Refill",
    category: "AC",
    description:
      "AC not cooling properly or giving bad smell? Full deep cleaning inside-out, filter wash, drain line flush and gas pressure check with refill if needed. Stay cool all summer.",
    image:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=800&auto=format&fit=crop",
    basePrice: 55,
    estimatedDuration: "1.5 hours",
    serviceMode: "Home Visit",
    serviceArea: "GEC Circle, Chattogram",
    technicianEmail: "sara@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "AC Installation & Uninstallation",
    category: "AC",
    description:
      "Shifting home or buying a new AC? Safe installation and uninstallation with proper copper piping, vacuum and pressure testing. All major brands supported.",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800&auto=format&fit=crop",
    basePrice: 70,
    estimatedDuration: "2 hours",
    serviceMode: "Home Visit",
    serviceArea: "GEC Circle, Chattogram",
    technicianEmail: "sara@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Refrigerator Cooling & Compressor Repair",
    category: "Refrigerator",
    description:
      "Fridge not cooling or making noise? We diagnose compressor, thermostat and cooling coil issues and repair with genuine spare parts. 90-day service warranty included.",
    image:
      "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?q=80&w=800&auto=format&fit=crop",
    basePrice: 95,
    estimatedDuration: "2 hours",
    serviceMode: "Home Visit",
    serviceArea: "GEC Circle, Chattogram",
    technicianEmail: "sara@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Refrigerator Door Seal & Thermostat Fix",
    category: "Refrigerator",
    description:
      "Fridge door not sealing or temperature fluctuating? We replace door gaskets and faulty thermostats to restore proper cooling and save electricity.",
    image:
      "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?q=80&w=800&auto=format&fit=crop",
    basePrice: 40,
    estimatedDuration: "1 hour",
    serviceMode: "Home Visit",
    serviceArea: "GEC Circle, Chattogram",
    technicianEmail: "sara@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "LED TV Display & Backlight Repair",
    category: "TV",
    description:
      "TV showing lines, dark patches or no picture? We repair LED backlights, T-CON boards and display panels for Samsung, LG, Sony, Walton and more at your home.",
    image:
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=800&auto=format&fit=crop",
    basePrice: 110,
    estimatedDuration: "2.5 hours",
    serviceMode: "Home Visit",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Smart TV Software & HDMI Port Fix",
    category: "TV",
    description:
      "Smart TV stuck on logo, apps crashing or HDMI not working? Software reinstall, firmware update and HDMI port repair with full setup after fix.",
    image:
      "https://images.unsplash.com/photo-1467293622093-9f15c96be70f?q=80&w=800&auto=format&fit=crop",
    basePrice: 50,
    estimatedDuration: "1 hour",
    serviceMode: "Shop Drop-off",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Washing Machine Motor & Drum Repair",
    category: "Washing Machine",
    description:
      "Washing machine vibrating, leaking or not spinning? We repair motors, drums, belts and control boards for front-load and top-load machines.",
    image:
      "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?q=80&w=800&auto=format&fit=crop",
    basePrice: 90,
    estimatedDuration: "2 hours",
    serviceMode: "Home Visit",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Washing Machine Drain & Pump Service",
    category: "Washing Machine",
    description:
      "Water not draining or machine smells bad? Complete drain pump cleaning, filter service and inlet valve check to bring your machine back to smooth operation.",
    image:
      "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?q=80&w=800&auto=format&fit=crop",
    basePrice: 45,
    estimatedDuration: "1 hour",
    serviceMode: "Home Visit",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Home Electrical Wiring & Switchboard Fix",
    category: "Electrical",
    description:
      "Sparking switches, tripping breakers or dead sockets? Certified electrician for full home wiring checks, switchboard repair and new point installation.",
    image:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?q=80&w=800&auto=format&fit=crop",
    basePrice: 35,
    estimatedDuration: "1.5 hours",
    serviceMode: "Home Visit",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "Ceiling Fan & Light Installation",
    category: "Electrical",
    description:
      "Need a new fan or chandelier installed? Safe mounting, wiring and testing for ceiling fans, LED panels and decorative lights.",
    image:
      "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=800&auto=format&fit=crop",
    basePrice: 30,
    estimatedDuration: "1 hour",
    serviceMode: "Home Visit",
    serviceArea: "Mirpur, Dhaka",
    technicianEmail: "rahim@fixmate.com",
    approvalStatus: "approved",
    isAvailable: true,
  },
  {
    title: "iPhone Water Damage Recovery",
    category: "Smartphone",
    description:
      "Dropped your iPhone in water? Immediate ultrasonic cleaning, board-level repair and battery safety check. Best chance of recovery if you act fast.",
    image:
      "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?q=80&w=800&auto=format&fit=crop",
    basePrice: 120,
    estimatedDuration: "4 hours",
    serviceMode: "Shop Drop-off",
    serviceArea: "Mirpur, Dhaka",
    technicianEmail: "rahim@fixmate.com",
    approvalStatus: "pending",
    isAvailable: true,
  },
  {
    title: "Desktop PC Build & Troubleshooting",
    category: "Laptop & PC",
    description:
      "Custom gaming or office PC build with cable management, plus diagnosis for no-display, overheating and Windows errors.",
    image:
      "https://images.unsplash.com/photo-1587831990711-23ca6441447b?q=80&w=800&auto=format&fit=crop",
    basePrice: 75,
    estimatedDuration: "3 hours",
    serviceMode: "Shop Drop-off",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "pending",
    isAvailable: true,
  },
  {
    title: "Split AC PCB & Sensor Repair",
    category: "AC",
    description:
      "AC showing error codes or turning off by itself? PCB and sensor-level repair for split ACs with genuine components.",
    image:
      "https://images.unsplash.com/photo-1631545806609-24040d63f8c3?q=80&w=800&auto=format&fit=crop",
    basePrice: 80,
    estimatedDuration: "2 hours",
    serviceMode: "Home Visit",
    serviceArea: "GEC Circle, Chattogram",
    technicianEmail: "sara@fixmate.com",
    approvalStatus: "pending",
    isAvailable: true,
  },
  {
    title: "Microwave Oven Repair",
    category: "Electrical",
    description:
      "Microwave not heating food? Magnetron and control panel repair. (This listing was rejected - incomplete service details.)",
    image:
      "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?q=80&w=800&auto=format&fit=crop",
    basePrice: 65,
    estimatedDuration: "1.5 hours",
    serviceMode: "Shop Drop-off",
    serviceArea: "Uttara, Dhaka",
    technicianEmail: "tanvir@fixmate.com",
    approvalStatus: "rejected",
    isAvailable: true,
  },
  {
    title: "Old CRT TV Repair",
    category: "TV",
    description:
      "CRT television repair service. (Rejected - service no longer offered.)",
    image:
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?q=80&w=800&auto=format&fit=crop",
    basePrice: 55,
    estimatedDuration: "2 hours",
    serviceMode: "Shop Drop-off",
    serviceArea: "Mirpur, Dhaka",
    technicianEmail: "rahim@fixmate.com",
    approvalStatus: "rejected",
    isAvailable: false,
  },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fixmate");

  console.log("Connected. Clearing old seed data...");

  const seedEmails = usersSeed.map((u) => u.email);
  const oldUsers = await db
    .collection("user")
    .find({ email: { $in: seedEmails } })
    .toArray();
  const oldIds = oldUsers.flatMap((u) => [u._id, u._id.toString()]);
  await db.collection("session").deleteMany({ userId: { $in: oldIds } });
  await db.collection("account").deleteMany({ userId: { $in: oldIds } });
  await db.collection("user").deleteMany({ email: { $in: seedEmails } });

  await db.collection("services").deleteMany({});
  await db.collection("bookings").deleteMany({});
  await db.collection("payments").deleteMany({});

  console.log("Creating users...");
  const userMap = {};
  for (const u of usersSeed) {
    const now = new Date();
    const userId = new ObjectId();
    const doc = {
      _id: userId,
      id: userId.toString(),
      name: u.name,
      email: u.email,
      emailVerified: true,
      image: u.image,
      role: u.role,
      phone: u.phone,
      area: u.area,
      bio: u.bio,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("user").insertOne(doc);
    userMap[u.email] = doc;

    const hashed = await hashPassword(u.password);
    const accountId = new ObjectId();
    await db.collection("account").insertOne({
      _id: accountId,
      id: accountId.toString(),
      userId,
      accountId: userId.toString(),
      providerId: "credential",
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log("Creating services...");
  const serviceDocs = [];
  for (let i = 0; i < servicesSeed.length; i++) {
    const s = servicesSeed[i];
    const tech = userMap[s.technicianEmail];
    const doc = {
      _id: new ObjectId(),
      title: s.title,
      category: s.category,
      description: s.description,
      image: s.image,
      basePrice: s.basePrice,
      estimatedDuration: s.estimatedDuration,
      serviceMode: s.serviceMode,
      serviceArea: s.serviceArea,
      technicianName: tech.name,
      technicianEmail: s.technicianEmail,
      approvalStatus: s.approvalStatus,
      isAvailable: s.isAvailable,
      createdAt: daysAgo(servicesSeed.length - i),
    };
    await db.collection("services").insertOne(doc);
    serviceDocs.push(doc);
  }

  const byTitle = {};
  serviceDocs.forEach((s) => (byTitle[s.title] = s));

  console.log("Creating bookings...");
  function history(statuses, startDaysAgo) {
    return statuses.map((status, idx) => ({
      status,
      changedAt: daysAgo(startDaysAgo - idx),
    }));
  }

  const bookingsSeed = [
    {
      serviceTitle: "Smartphone Screen Replacement",
      customerEmail: "customer@fixmate.com",
      customerPhone: "+8801744444444",
      address: "House 12, Road 5, Dhanmondi, Dhaka",
      preferredDate: daysAgo(-2),
      problemDescription:
        "Screen cracked after a fall. Touch still works but display has lines. Need replacement urgently.",
      status: "requested",
      finalAmount: 45,
      paymentStatus: "unpaid",
      statusHistory: history(["requested"], 2),
      createdAt: daysAgo(2),
    },
    {
      serviceTitle: "AC Deep Cleaning & Gas Refill",
      customerEmail: "nusrat@fixmate.com",
      customerPhone: "+8801755555555",
      address: "Flat B-4, Agrabad Commercial Area, Chattogram",
      preferredDate: daysAgo(-1),
      problemDescription:
        "AC cooling is weak and there is a musty smell. Haven not cleaned in over a year. Please do deep cleaning.",
      status: "accepted",
      finalAmount: 55,
      paymentStatus: "unpaid",
      statusHistory: history(["requested", "accepted"], 3),
      createdAt: daysAgo(3),
    },
    {
      serviceTitle: "LED TV Display & Backlight Repair",
      customerEmail: "mehedi@fixmate.com",
      customerPhone: "+8801766666666",
      address: "House 8, Road 11, Banani, Dhaka",
      preferredDate: daysAgo(0),
      problemDescription:
        "TV picture went dark but sound is fine. Technician said it might be backlight issue. Please check and fix.",
      status: "in-progress",
      finalAmount: 110,
      paymentStatus: "unpaid",
      statusHistory: history(["requested", "accepted", "in-progress"], 4),
      createdAt: daysAgo(4),
    },
    {
      serviceTitle: "Laptop Screen & Keyboard Repair",
      customerEmail: "customer@fixmate.com",
      customerPhone: "+8801744444444",
      address: "House 12, Road 5, Dhanmondi, Dhaka",
      preferredDate: daysAgo(5),
      problemDescription:
        "Laptop screen flickers and two keys stopped working. Need both fixed before office work resumes.",
      status: "completed",
      finalAmount: 90,
      paymentStatus: "unpaid",
      statusHistory: history(
        ["requested", "accepted", "in-progress", "completed"],
        8,
      ),
      createdAt: daysAgo(8),
    },
    {
      serviceTitle: "Refrigerator Cooling & Compressor Repair",
      customerEmail: "nusrat@fixmate.com",
      customerPhone: "+8801755555555",
      address: "Flat B-4, Agrabad Commercial Area, Chattogram",
      preferredDate: daysAgo(10),
      problemDescription:
        "Fridge stopped cooling completely. Food is spoiling. Compressor makes clicking sound but does not start.",
      status: "completed",
      finalAmount: 95,
      paymentStatus: "paid",
      statusHistory: history(
        ["requested", "accepted", "in-progress", "completed"],
        12,
      ),
      createdAt: daysAgo(12),
    },
    {
      serviceTitle: "Washing Machine Motor & Drum Repair",
      customerEmail: "mehedi@fixmate.com",
      customerPhone: "+8801766666666",
      address: "House 8, Road 11, Banani, Dhaka",
      preferredDate: daysAgo(14),
      problemDescription:
        "Washing machine vibrates heavily during spin cycle and makes grinding noise. Drum seems loose.",
      status: "completed",
      finalAmount: 90,
      paymentStatus: "paid",
      statusHistory: history(
        ["requested", "accepted", "in-progress", "completed"],
        16,
      ),
      createdAt: daysAgo(16),
    },
    {
      serviceTitle: "Home Electrical Wiring & Switchboard Fix",
      customerEmail: "customer@fixmate.com",
      customerPhone: "+8801744444444",
      address: "House 12, Road 5, Dhanmondi, Dhaka",
      preferredDate: daysAgo(6),
      problemDescription:
        "Living room switchboard sparks when turning on the fan. Breaker trips sometimes. Need urgent check.",
      status: "rejected",
      finalAmount: 35,
      paymentStatus: "unpaid",
      statusHistory: history(["requested", "rejected"], 6),
      createdAt: daysAgo(6),
    },
    {
      serviceTitle: "Smartphone Battery & Charging Port Fix",
      customerEmail: "nusrat@fixmate.com",
      customerPhone: "+8801755555555",
      address: "Flat B-4, Agrabad Commercial Area, Chattogram",
      preferredDate: daysAgo(7),
      problemDescription:
        "Phone battery drains in 3 hours and charging cable needs to be held at an angle to charge. Please replace battery and fix port.",
      status: "cancelled",
      finalAmount: 25,
      paymentStatus: "unpaid",
      statusHistory: history(["requested", "cancelled"], 7),
      createdAt: daysAgo(7),
    },
  ];

  const bookingDocs = [];
  for (const b of bookingsSeed) {
    const service = byTitle[b.serviceTitle];
    const customer = userMap[b.customerEmail];
    const doc = {
      _id: new ObjectId(),
      serviceId: service._id,
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: customer.name,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      address: b.address,
      preferredDate: b.preferredDate,
      problemDescription: b.problemDescription,
      status: b.status,
      finalAmount: b.finalAmount,
      paymentStatus: b.paymentStatus,
      statusHistory: b.statusHistory,
      createdAt: b.createdAt,
    };
    await db.collection("bookings").insertOne(doc);
    bookingDocs.push(doc);
  }

  console.log("Creating payments...");
  const paidBookings = bookingDocs.filter((b) => b.paymentStatus === "paid");
  for (let i = 0; i < paidBookings.length; i++) {
    const b = paidBookings[i];
    await db.collection("payments").insertOne({
      _id: new ObjectId(),
      bookingId: b._id,
      serviceTitle: b.serviceTitle,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      technicianName: b.technicianName,
      technicianEmail: b.technicianEmail,
      amount: b.finalAmount,
      currency: "usd",
      transactionId: `pi_test_seed_${i + 1}`,
      stripeSessionId: `cs_test_seed_${i + 1}`,
      paymentStatus: "paid",
      paidAt: daysAgo(2 - i),
    });
  }

  // Make sure the unique index exists (also created on server start)
  await require("./config/indexes").ensureIndexes(db);

  console.log("\nSeed complete! Test logins:\n");
  console.log("Admin:      admin@fixmate.com / Admin123");
  console.log("Technician: rahim@fixmate.com / Rahim123");
  console.log("Technician: sara@fixmate.com / Sara123");
  console.log("Technician: tanvir@fixmate.com / Tanvir123");
  console.log("Customer:   customer@fixmate.com / Customer123");
  console.log("Customer:   nusrat@fixmate.com / Nusrat123");
  console.log("Customer:   mehedi@fixmate.com / Mehedi123");

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
