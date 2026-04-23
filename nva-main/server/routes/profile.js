const express = require("express");
const { requireAuth } = require("../auth");
const { normalizeList, sanitizeProfile } = require("../utils");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  res.json({ profile: sanitizeProfile(req.profile) });
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const allowed = ["name", "age", "gender", "activityLevel", "primaryGoal"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) req.profile[field] = req.body[field];
    });

    if (req.body.medicalConditions !== undefined) req.profile.medicalConditions = normalizeList(req.body.medicalConditions);
    if (req.body.dietaryRestrictions !== undefined) req.profile.dietaryRestrictions = normalizeList(req.body.dietaryRestrictions);
    if (req.body.allergies !== undefined) req.profile.allergies = normalizeList(req.body.allergies);

    if (req.body.dailyGoals) {
      req.profile.dailyGoals = {
        calories: Number(req.body.dailyGoals.calories || req.profile.dailyGoals.calories || 2200),
        protein: Number(req.body.dailyGoals.protein || req.profile.dailyGoals.protein || 140),
        carbs: Number(req.body.dailyGoals.carbs || req.profile.dailyGoals.carbs || 250),
        fat: Number(req.body.dailyGoals.fat || req.profile.dailyGoals.fat || 70),
        water: Number(req.body.dailyGoals.water || req.profile.dailyGoals.water || 8)
      };
    }

    await req.profile.save();
    res.json({ profile: sanitizeProfile(req.profile) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile", details: error.message });
  }
});

router.put("/onboarding", requireAuth, async (req, res) => {
  try {
    req.profile.age = req.body.age || req.profile.age;
    req.profile.gender = req.body.gender || req.profile.gender;
    req.profile.activityLevel = req.body.activityLevel || req.profile.activityLevel;
    req.profile.primaryGoal = req.body.primaryGoal || req.profile.primaryGoal;
    req.profile.medicalConditions = normalizeList(req.body.medicalConditions);
    req.profile.dietaryRestrictions = normalizeList(req.body.dietaryRestrictions);
    req.profile.allergies = normalizeList(req.body.allergies);
    req.profile.onboardingComplete = true;
    await req.profile.save();
    res.json({ profile: sanitizeProfile(req.profile) });
  } catch (error) {
    res.status(500).json({ error: "Failed to save onboarding", details: error.message });
  }
});

router.put("/settings", requireAuth, async (req, res) => {
  try {
    req.profile.settings = {
      notifications: {
        ...req.profile.settings.notifications,
        ...(req.body.notifications || {})
      },
      privacy: {
        ...req.profile.settings.privacy,
        ...(req.body.privacy || {})
      },
      accessibility: {
        ...req.profile.settings.accessibility,
        ...(req.body.accessibility || {})
      }
    };
    await req.profile.save();
    res.json({ settings: req.profile.settings, profile: sanitizeProfile(req.profile) });
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings", details: error.message });
  }
});

module.exports = router;
