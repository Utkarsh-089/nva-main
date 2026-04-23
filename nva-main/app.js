const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const { connectDB } = require("./server/db");
const authRoutes = require("./server/routes/auth");
const profileRoutes = require("./server/routes/profile");
const logRoutes = require("./server/routes/logs");
const dashboardRoutes = require("./server/routes/dashboard");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "6mb" }));
app.use(express.static(publicDir));

app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/auth", (req, res) => res.sendFile(path.join(publicDir, "auth.html")));
app.get("/onboarding", (req, res) => res.sendFile(path.join(publicDir, "onboarding.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(publicDir, "dashboard.html")));
app.get("/profile", (req, res) => res.sendFile(path.join(publicDir, "profile.html")));
app.get("/settings", (req, res) => res.sendFile(path.join(publicDir, "settings.html")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", logRoutes);
app.use("/api", dashboardRoutes);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Route not found" });
  res.status(404).sendFile(path.join(publicDir, "index.html"));
});

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Nutri Vision full-stack app running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
};

start();
