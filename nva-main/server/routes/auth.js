const express = require("express");
const { Profile, Session } = require("../models");
const { requireAuth } = require("../auth");
const { hashPassword, verifyPassword, createSessionToken, sanitizeProfile } = require("../utils");

const router = express.Router();

const createSession = async (profileId) => {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await Session.create({ profileId, token, expiresAt });
  return token;
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required" });
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await Profile.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const profile = await Profile.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: hashPassword(password)
    });

    const token = await createSession(profile._id);
    res.status(201).json({ token, profile: sanitizeProfile(profile) });
  } catch (error) {
    res.status(500).json({ error: "Failed to create account", details: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const profile = await Profile.findOne({ email: String(email).toLowerCase().trim() });
    if (!profile || !verifyPassword(password, profile.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await Session.deleteMany({ profileId: profile._id, expiresAt: { $lte: new Date() } });
    const token = await createSession(profile._id);
    res.json({ token, profile: sanitizeProfile(profile) });
  } catch (error) {
    res.status(500).json({ error: "Login failed", details: error.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ profile: sanitizeProfile(req.profile) });
});

router.post("/logout", requireAuth, async (req, res) => {
  await Session.deleteOne({ _id: req.session._id });
  res.json({ success: true });
});

module.exports = router;
