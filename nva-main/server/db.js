const mongoose = require("mongoose");

mongoose.set("strictQuery", true);

let reconnectTimer = null;
let shuttingDown = false;

const scheduleReconnect = () => {
  if (shuttingDown || reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await connectDB();
    } catch (error) {
      console.error("Reconnect failed:", error.message);
      scheduleReconnect();
    }
  }, 5000);
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "";
  if (!uri) throw new Error("Missing MONGO_URI in .env");
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return mongoose.connection;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    autoIndex: true
  });

  return mongoose.connection;
};

mongoose.connection.on("connected", () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  console.log("MongoDB connected");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB error:", error.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
  scheduleReconnect();
});

const shutdown = async () => {
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  try {
    await mongoose.connection.close();
  } catch (error) {
    console.error("MongoDB shutdown error:", error.message);
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { connectDB };
