const { MongoClient } = require("mongodb");
const { ensureIndexes } = require("./indexes");
let client;
let db;
let connecting;
async function connectDB() {
  if (db) return db;
  if (connecting) return connecting;
  connecting = (async () => {
    if (!process.env.MONGODB_URI)
      throw new Error("MONGODB_URI is not set. Check your .env file.");
    client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const connected = client.db("fixmate");
      await ensureIndexes(connected);
      db = connected;
      return db;
    } catch (err) {
      await client.close();
      throw err;
    }
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}
function getDB() {
  if (!db) throw new Error("DB not connected yet. Call connectDB() first.");
  return db;
}
async function closeDB() {
  if (client) await client.close();
  db = null;
}
module.exports = { connectDB, getDB, closeDB };
