const crypto = require("crypto");

const FOOD_DB = [
  { keys: ["egg", "eggs"], item: { name: "Eggs", unit: "piece", calories: 78, protein: 6, carbs: 0.6, fat: 5, fiber: 0, sugar: 0.2 } },
  { keys: ["toast", "bread"], item: { name: "Toast", unit: "slice", calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 2, sugar: 2 } },
  { keys: ["chicken"], item: { name: "Grilled Chicken", unit: "serving", calories: 220, protein: 35, carbs: 0, fat: 8, fiber: 0, sugar: 0 } },
  { keys: ["rice"], item: { name: "Rice", unit: "cup", calories: 205, protein: 4, carbs: 45, fat: 0.4, fiber: 0.6, sugar: 0.1 } },
  { keys: ["oats", "oatmeal"], item: { name: "Oats", unit: "bowl", calories: 190, protein: 6, carbs: 32, fat: 4, fiber: 5, sugar: 1 } },
  { keys: ["banana"], item: { name: "Banana", unit: "piece", calories: 105, protein: 1.3, carbs: 27, fat: 0.3, fiber: 3.1, sugar: 14 } },
  { keys: ["apple"], item: { name: "Apple", unit: "piece", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, sugar: 19 } },
  { keys: ["salad"], item: { name: "Salad Bowl", unit: "bowl", calories: 180, protein: 6, carbs: 15, fat: 10, fiber: 4, sugar: 4 } },
  { keys: ["paneer"], item: { name: "Paneer", unit: "serving", calories: 265, protein: 18, carbs: 6, fat: 20, fiber: 0, sugar: 3 } },
  { keys: ["dal", "lentil"], item: { name: "Dal", unit: "bowl", calories: 210, protein: 12, carbs: 30, fat: 5, fiber: 8, sugar: 4 } },
  { keys: ["yogurt", "curd"], item: { name: "Greek Yogurt", unit: "cup", calories: 130, protein: 17, carbs: 7, fat: 3, fiber: 0, sugar: 6 } },
  { keys: ["smoothie"], item: { name: "Smoothie", unit: "glass", calories: 240, protein: 10, carbs: 36, fat: 6, fiber: 4, sugar: 20 } },
  { keys: ["protein shake"], item: { name: "Protein Shake", unit: "glass", calories: 180, protein: 24, carbs: 10, fat: 4, fiber: 2, sugar: 5 } },
  { keys: ["vegetable", "veggies"], item: { name: "Mixed Vegetables", unit: "bowl", calories: 90, protein: 3, carbs: 14, fat: 2, fiber: 5, sugar: 5 } },
  { keys: ["fish"], item: { name: "Fish", unit: "serving", calories: 200, protein: 28, carbs: 0, fat: 9, fiber: 0, sugar: 0 } }
];

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round(value * 10) / 10;

const clamp = (value, min = 0) => Math.max(min, value);

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
};

const dateKey = (input) => {
  const date = input ? new Date(input) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
};

const dayRange = (key) => {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, passwordHash) => {
  const [salt, original] = String(passwordHash || "").split(":");
  if (!salt || !original) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(original, "hex"));
};

const createSessionToken = () => crypto.randomBytes(32).toString("hex");

const sanitizeProfile = (profile) => {
  if (!profile) return null;
  const obj = profile.toObject ? profile.toObject() : { ...profile };
  delete obj.passwordHash;
  return obj;
};

const parseQuantity = (text, word) => {
  const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s+${word}`, "i");
  const match = text.match(regex);
  return match ? clamp(num(match[1]), 0.5) : 1;
};

const estimateNutrition = ({ text = "", source = "text", imageName = "" }) => {
  const input = `${text} ${imageName}`.toLowerCase();
  const items = [];

  FOOD_DB.forEach((entry) => {
    if (entry.keys.some((key) => input.includes(key))) {
      const keyForQty = entry.keys.find((key) => input.includes(key)) || entry.keys[0];
      const quantity = Math.min(parseQuantity(input, keyForQty), 4);
      items.push({
        name: entry.item.name,
        quantity,
        unit: entry.item.unit,
        calories: round(entry.item.calories * quantity),
        protein: round(entry.item.protein * quantity),
        carbs: round(entry.item.carbs * quantity),
        fat: round(entry.item.fat * quantity),
        fiber: round(entry.item.fiber * quantity),
        sugar: round(entry.item.sugar * quantity),
        confidence: source === "image" ? 0.52 : 0.72
      });
    }
  });

  if (!items.length) {
    items.push({
      name: source === "image" ? "Meal from image" : "Custom meal",
      quantity: 1,
      unit: "serving",
      calories: 260,
      protein: 14,
      carbs: 24,
      fat: 10,
      fiber: 3,
      sugar: 4,
      confidence: 0.4
    });
  }

  return items;
};

const sumItems = (items) =>
  items.reduce(
    (acc, item) => {
      acc.calories += clamp(num(item.calories));
      acc.protein += clamp(num(item.protein));
      acc.carbs += clamp(num(item.carbs));
      acc.fat += clamp(num(item.fat));
      acc.fiber += clamp(num(item.fiber));
      acc.sugar += clamp(num(item.sugar));
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
  );

const summarizeDay = ({ profile, logs, water = 0 }) => {
  const totals = logs.reduce(
    (acc, log) => {
      acc.calories += num(log.totals?.calories);
      acc.protein += num(log.totals?.protein);
      acc.carbs += num(log.totals?.carbs);
      acc.fat += num(log.totals?.fat);
      acc.fiber += num(log.totals?.fiber);
      acc.sugar += num(log.totals?.sugar);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
  );

  const goals = profile.dailyGoals || {};
  const pct = (value, goal) => (goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0);

  return {
    totals: {
      calories: round(totals.calories),
      protein: round(totals.protein),
      carbs: round(totals.carbs),
      fat: round(totals.fat),
      fiber: round(totals.fiber),
      sugar: round(totals.sugar)
    },
    water: clamp(num(water)),
    goals,
    mealsLogged: logs.length,
    recentMeals: logs
      .slice()
      .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt))
      .slice(0, 6)
      .map((log) => ({
        id: log._id,
        description: log.description,
        mealType: log.mealType,
        source: log.source,
        loggedAt: log.loggedAt,
        calories: round(num(log.totals?.calories))
      })),
    progress: {
      calories: pct(totals.calories, goals.calories || 0),
      protein: pct(totals.protein, goals.protein || 0),
      carbs: pct(totals.carbs, goals.carbs || 0),
      fat: pct(totals.fat, goals.fat || 0),
      water: pct(water, goals.water || 0)
    }
  };
};

const buildTrend = (logs, days = 7) => {
  const map = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - i);
    const key = day.toISOString().slice(0, 10);
    map.set(key, {
      key,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      calories: 0
    });
  }

  logs.forEach((log) => {
    const key = new Date(log.loggedAt).toISOString().slice(0, 10);
    if (map.has(key)) map.get(key).calories += num(log.totals?.calories);
  });

  return Array.from(map.values()).map((item) => ({ ...item, calories: round(item.calories) }));
};

const buildAlerts = (profile, summary) => {
  const alerts = [];
  const conditions = (profile.medicalConditions || []).map((item) => item.toLowerCase());
  const restrictions = (profile.dietaryRestrictions || []).map((item) => item.toLowerCase());

  if (summary.water < (profile.dailyGoals?.water || 8) / 2) {
    alerts.push({ severity: "medium", title: "Hydration lagging", message: "You are below half of your water goal today." });
  }
  if (conditions.some((item) => item.includes("diabetes")) && summary.totals.carbs > (profile.dailyGoals?.carbs || 250)) {
    alerts.push({ severity: "high", title: "High carb intake", message: "Today’s carbs are above your target for a diabetes-aware plan." });
  }
  if (conditions.some((item) => item.includes("hypertension")) && summary.totals.calories > (profile.dailyGoals?.calories || 2200) * 1.15) {
    alerts.push({ severity: "medium", title: "Watch heavier meals", message: "Large meals can make heart-friendly eating harder to sustain." });
  }
  if (restrictions.includes("low-carb") && summary.totals.carbs > (profile.dailyGoals?.carbs || 250)) {
    alerts.push({ severity: "medium", title: "Restriction mismatch", message: "Your intake is running above your low-carb target today." });
  }
  if (!alerts.length) {
    alerts.push({ severity: "low", title: "No major conflicts", message: "Your logged meals do not show obvious nutrition conflicts right now." });
  }
  return alerts;
};

const buildSuggestions = (profile, summary) => {
  const restrictions = (profile.dietaryRestrictions || []).map((item) => item.toLowerCase());
  const vegetarian = restrictions.includes("vegetarian");
  const vegan = restrictions.includes("vegan");
  const lowCarb = restrictions.includes("low-carb") || restrictions.includes("keto");
  const suggestions = [];

  if (summary.totals.protein < (profile.dailyGoals?.protein || 140) * 0.8) {
    if (vegan) suggestions.push({ title: "Tofu quinoa bowl", reason: "Boost protein while staying fully plant-based." });
    else if (vegetarian) suggestions.push({ title: "Greek yogurt with seeds", reason: "Fast protein boost that fits a vegetarian plan." });
    else suggestions.push({ title: "Chicken salad wrap", reason: "Lean protein to help close today’s macro gap." });
  }
  if (summary.totals.calories < (profile.dailyGoals?.calories || 2200) * 0.75) {
    suggestions.push({
      title: lowCarb ? "Paneer and avocado snack plate" : "Rice bowl with beans and veggies",
      reason: "Adds balanced calories without feeling too heavy."
    });
  }
  if (summary.water < (profile.dailyGoals?.water || 8)) {
    suggestions.push({ title: "Hydration reset", reason: "Drink 2 more glasses of water with your next meal." });
  }
  if (!suggestions.length) {
    suggestions.push({ title: "Stay consistent", reason: "You’re close to target. Keep the next meal simple and balanced." });
  }
  return suggestions.slice(0, 4);
};

const buildInsights = (profile, summary) => {
  let score = 100;
  const notes = [];
  const recommendations = [];

  if (summary.mealsLogged === 0) {
    score -= 35;
    notes.push("No meals logged today.");
    recommendations.push("Start with your first meal log so Nutri Vision can calculate accurate guidance.");
  }
  if (summary.totals.protein < (profile.dailyGoals?.protein || 140) * 0.8) {
    score -= 12;
    notes.push("Protein intake is below target.");
    recommendations.push("Add a protein-focused meal or snack.");
  } else {
    notes.push("Protein intake is tracking well.");
  }
  if (summary.totals.calories > (profile.dailyGoals?.calories || 2200) * 1.1) {
    score -= 10;
    notes.push("Calories are above your daily goal.");
    recommendations.push("Keep the next meal lighter and prioritize fiber and lean protein.");
  }
  if (summary.water < (profile.dailyGoals?.water || 8) * 0.75) {
    score -= 8;
    notes.push("Hydration is behind goal.");
    recommendations.push("Drink more water steadily instead of all at once.");
  }

  score = Math.max(0, Math.round(score));

  return {
    score,
    summary:
      score >= 85
        ? "You’re having a strong nutrition day overall."
        : score >= 65
        ? "Your day is decent, with a few gaps left to close."
        : "Your current intake needs some correction to better match your goals.",
    macroAnalysis: notes,
    recommendations: recommendations.slice(0, 4)
  };
};

const buildVoiceReply = (message, { profile, summary }) => {
  const text = String(message || "").toLowerCase();
  if (!text.trim()) return "Ask me about your calories, water, protein, or today’s meals.";
  if (text.includes("calorie")) return `You are at ${summary.totals.calories} calories out of a goal of ${profile.dailyGoals.calories}.`;
  if (text.includes("protein")) return `You have logged ${summary.totals.protein} grams of protein today.`;
  if (text.includes("water") || text.includes("hydration")) return `You have had ${summary.water} glasses of water out of ${profile.dailyGoals.water}.`;
  if (text.includes("what did i eat") || text.includes("meals")) {
    if (!summary.recentMeals.length) return "You have not logged any meals today yet.";
    return `Today you logged ${summary.recentMeals.map((meal) => meal.description).join(", ")}.`;
  }
  const insight = buildInsights(profile, summary);
  return `${insight.summary} Main focus: ${insight.recommendations[0] || "keep logging consistently."}`;
};

module.exports = {
  normalizeList,
  dateKey,
  dayRange,
  hashPassword,
  verifyPassword,
  createSessionToken,
  sanitizeProfile,
  estimateNutrition,
  sumItems,
  summarizeDay,
  buildTrend,
  buildAlerts,
  buildSuggestions,
  buildInsights,
  buildVoiceReply
};
