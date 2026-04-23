const express = require("express");
const { requireAuth } = require("../auth");
const { FoodLog, DailyStat } = require("../models");
const {
  dateKey,
  dayRange,
  summarizeDay,
  buildTrend,
  buildAlerts,
  buildSuggestions,
  buildInsights
} = require("../utils");
const { generateAiDashboard, generateVoiceReply } = require("../services/ai");

const router = express.Router();

const loadContext = async (profile, rawDate) => {
  const date = dateKey(rawDate);
  const { start, end } = dayRange(date);
  const trendStart = new Date();
  trendStart.setUTCDate(trendStart.getUTCDate() - 6);
  trendStart.setUTCHours(0, 0, 0, 0);

  const [logs, trendLogs, stat] = await Promise.all([
    FoodLog.find({ profileId: profile._id, loggedAt: { $gte: start, $lt: end } }).sort({ loggedAt: -1 }).lean(),
    FoodLog.find({ profileId: profile._id, loggedAt: { $gte: trendStart } }).lean(),
    DailyStat.findOne({ profileId: profile._id, date }).lean()
  ]);

  const summary = summarizeDay({ profile, logs, water: stat?.waterGlasses || 0 });
  const fallback = {
    alerts: buildAlerts(profile, summary),
    mealSuggestions: buildSuggestions(profile, summary),
    insights: buildInsights(profile, summary)
  };

  const ai = await generateAiDashboard({ profile, summary, logs });

  return {
    date,
    logs,
    summary,
    trend: buildTrend(trendLogs),
    providers: {
      insights: ai.insights?.provider || "heuristic-fallback",
      alerts: ai.alertsProvider || ai.insights?.provider || "heuristic-fallback",
      mealSuggestions: ai.suggestionsProvider || ai.insights?.provider || "heuristic-fallback",
      recentFoodLogs: logs.slice(0, 6).map((log) => ({
        id: String(log._id),
        description: log.description,
        provider: log.analysisProvider || "manual"
      }))
    },
    alerts: ai.alerts || fallback.alerts,
    mealSuggestions: ai.mealSuggestions || fallback.mealSuggestions,
    insights: ai.insights || fallback.insights
  };
};

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const profile = req.profile.toObject ? req.profile.toObject() : req.profile;
    res.json(await loadContext(profile, req.query.date));
  } catch (error) {
    res.status(500).json({ error: "Failed to build dashboard", details: error.message });
  }
});

router.get("/insights", requireAuth, async (req, res) => {
  try {
    const profile = req.profile.toObject ? req.profile.toObject() : req.profile;
    const data = await loadContext(profile, req.query.date);
    res.json(data.insights);
  } catch (error) {
    res.status(500).json({ error: "Failed to build insights", details: error.message });
  }
});

router.get("/meal-suggestions", requireAuth, async (req, res) => {
  try {
    const profile = req.profile.toObject ? req.profile.toObject() : req.profile;
    const data = await loadContext(profile, req.query.date);
    res.json({ suggestions: data.mealSuggestions });
  } catch (error) {
    res.status(500).json({ error: "Failed to build meal suggestions", details: error.message });
  }
});

router.get("/alerts", requireAuth, async (req, res) => {
  try {
    const profile = req.profile.toObject ? req.profile.toObject() : req.profile;
    const data = await loadContext(profile, req.query.date);
    res.json({ alerts: data.alerts });
  } catch (error) {
    res.status(500).json({ error: "Failed to build alerts", details: error.message });
  }
});

router.post("/voice-chat", requireAuth, async (req, res) => {
  try {
    const profile = req.profile.toObject ? req.profile.toObject() : req.profile;
    const data = await loadContext(profile, req.body.date);
    const reply = await generateVoiceReply({
      message: req.body.message,
      profile,
      summary: data.summary,
      logs: data.logs
    });
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: "Failed to answer voice query", details: error.message });
  }
});

module.exports = router;
