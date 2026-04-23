const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../auth");
const { FoodLog, DailyStat } = require("../models");
const { dateKey, dayRange, sumItems } = require("../utils");
const { analyzeNutrition } = require("../services/ai");

const router = express.Router();

router.post("/food-logs/analyze", requireAuth, async (req, res) => {
  try {
    const analysis = await analyzeNutrition({
      description: req.body.description || req.body.text || "",
      imageName: req.body.imageName || "",
      source: req.body.source || "text",
      imageData: req.body.imageData || "",
      imageMimeType: req.body.imageMimeType || ""
    });
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: "Failed to analyze input", details: error.message });
  }
});

router.get("/food-logs", requireAuth, async (req, res) => {
  try {
    const filter = { profileId: req.profile._id };
    if (req.query.date) {
      const { start, end } = dayRange(dateKey(req.query.date));
      filter.loggedAt = { $gte: start, $lt: end };
    }
    const logs = await FoodLog.find(filter).sort({ loggedAt: -1 });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch food logs", details: error.message });
  }
});

router.post("/food-logs", requireAuth, async (req, res) => {
  try {
    let items = Array.isArray(req.body.items) && req.body.items.length ? req.body.items : null;
    let provider = req.body.provider || "manual";
    if (!items) {
      const analysis = await analyzeNutrition({
        description: req.body.description || req.body.text || "",
        imageName: req.body.imageName || "",
        source: req.body.source || "text",
        imageData: req.body.imageData || "",
        imageMimeType: req.body.imageMimeType || ""
      });
      items = analysis.items;
      provider = analysis.provider;
    }

    const log = await FoodLog.create({
      profileId: req.profile._id,
      description: req.body.description || req.body.text || items.map((item) => item.name).join(", "),
      mealType: req.body.mealType || "meal",
      source: req.body.source || provider || "text",
      analysisProvider: provider,
      items,
      totals: sumItems(items),
      notes: req.body.notes || "",
      imageName: req.body.imageName || "",
      loggedAt: req.body.loggedAt ? new Date(req.body.loggedAt) : new Date()
    });

    res.status(201).json({ log });
  } catch (error) {
    res.status(500).json({ error: "Failed to create food log", details: error.message });
  }
});

router.put("/food-logs/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid food log id" });
    const log = await FoodLog.findOne({ _id: req.params.id, profileId: req.profile._id });
    if (!log) return res.status(404).json({ error: "Food log not found" });

    if (req.body.description !== undefined) log.description = req.body.description;
    if (req.body.mealType !== undefined) log.mealType = req.body.mealType;
    if (req.body.notes !== undefined) log.notes = req.body.notes;
    if (req.body.source !== undefined) log.source = req.body.source;
    if (req.body.analysisProvider !== undefined) log.analysisProvider = req.body.analysisProvider;
    if (req.body.imageName !== undefined) log.imageName = req.body.imageName;
    if (req.body.loggedAt) log.loggedAt = new Date(req.body.loggedAt);
    if (Array.isArray(req.body.items) && req.body.items.length) {
      log.items = req.body.items;
      log.totals = sumItems(req.body.items);
    }

    await log.save();
    res.json({ log });
  } catch (error) {
    res.status(500).json({ error: "Failed to update food log", details: error.message });
  }
});

router.delete("/food-logs/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid food log id" });
    const log = await FoodLog.findOneAndDelete({ _id: req.params.id, profileId: req.profile._id });
    if (!log) return res.status(404).json({ error: "Food log not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete food log", details: error.message });
  }
});

router.get("/water", requireAuth, async (req, res) => {
  try {
    const date = dateKey(req.query.date);
    const stat = await DailyStat.findOne({ profileId: req.profile._id, date });
    res.json({ date, waterGlasses: stat?.waterGlasses || 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch water", details: error.message });
  }
});

router.post("/water", requireAuth, async (req, res) => {
  try {
    const date = dateKey(req.body.date);
    const current = await DailyStat.findOne({ profileId: req.profile._id, date });
    const waterGlasses =
      req.body.waterGlasses !== undefined
        ? Math.max(0, Number(req.body.waterGlasses) || 0)
        : Math.max(0, Number(current?.waterGlasses || 0) + Number(req.body.delta || 0));

    const stat = await DailyStat.findOneAndUpdate(
      { profileId: req.profile._id, date },
      { waterGlasses },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ date, waterGlasses: stat.waterGlasses });
  } catch (error) {
    res.status(500).json({ error: "Failed to update water", details: error.message });
  }
});

module.exports = router;
