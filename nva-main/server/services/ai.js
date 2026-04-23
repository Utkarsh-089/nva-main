const {
  estimateNutrition,
  sumItems,
  buildAlerts,
  buildSuggestions,
  buildInsights,
  buildVoiceReply
} = require("../utils");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_URL = (model = GEMINI_MODEL) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(value.slice(start, end + 1));
      } catch {}
    }
    const arrayStart = value.indexOf("[");
    const arrayEnd = value.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(value.slice(arrayStart, arrayEnd + 1));
      } catch {}
    }
    return null;
  }
};

const extractGeminiText = (payload) =>
  payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";

const callGemini = async ({ systemInstruction, parts, responseMimeType = "application/json", model = GEMINI_MODEL }) => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.25,
      responseMimeType
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      role: "system",
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(GEMINI_URL(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Gemini request failed");
  }

  const text = extractGeminiText(payload);
  return responseMimeType === "application/json" ? safeJsonParse(text) : text;
};

const normalizeNutritionResult = (raw, fallbackSource) => {
  if (!raw) return null;

  const normalizedItems = Array.isArray(raw.items)
    ? raw.items.map((item) => ({
        name: String(item.name || item.food || "Food").trim(),
        quantity: Number(item.quantity || 1),
        unit: String(item.unit || "serving").trim(),
        calories: Number(item.calories ?? item.macros?.calories ?? 0),
        protein: Number(item.protein ?? item.macros?.protein ?? 0),
        carbs: Number(item.carbs ?? item.macros?.carbs ?? 0),
        fat: Number(item.fat ?? item.macros?.fat ?? item.macros?.fats ?? 0),
        fiber: Number(item.fiber ?? item.macros?.fiber ?? 0),
        sugar: Number(item.sugar ?? item.macros?.sugar ?? 0),
        confidence: Number(item.confidence ?? 0.72)
      }))
    : null;

  if (!normalizedItems || !normalizedItems.length) return null;

  return {
    items: normalizedItems,
    totals: sumItems(normalizedItems),
    provider: raw.provider || fallbackSource
  };
};

const tryExternalNutritionApi = async (description) => {
  const baseUrl = process.env.NUTRI_VISION_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: description, include_usda: true })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "External nutrition API failed");
  return normalizeNutritionResult(payload, "nutri-vision-api");
};

const tryGeminiNutrition = async ({ description, source, imageData, imageMimeType, imageName }) => {
  const parts = [
    {
      text:
        source === "image"
          ? `Estimate the food items and nutrition from this meal image. Caption: ${description || imageName || "none"}. Return strict JSON with keys items and provider. Each item must include name, quantity, unit, calories, protein, carbs, fat, fiber, sugar, confidence.`
          : `Analyze this food log and estimate nutrition. Food log: ${description}. Return strict JSON with keys items and provider. Each item must include name, quantity, unit, calories, protein, carbs, fat, fiber, sugar, confidence.`
    }
  ];

  if (source === "image" && imageData && imageMimeType) {
    parts.push({
      inlineData: {
        mimeType: imageMimeType,
        data: imageData
      }
    });
  }

  const payload = await callGemini({
    systemInstruction:
      "You are a nutrition analysis engine. Return only valid JSON. Estimate realistic macros for each detected food item.",
    parts
  });

  return normalizeNutritionResult(payload, "gemini");
};

const analyzeNutrition = async ({ description = "", source = "text", imageData = "", imageMimeType = "", imageName = "" }) => {
  try {
    if (source !== "image") {
      const external = await tryExternalNutritionApi(description);
      if (external) return external;
    }
  } catch (error) {
    console.warn("External nutrition API fallback:", error.message);
  }

  try {
    const gemini = await tryGeminiNutrition({ description, source, imageData, imageMimeType, imageName });
    if (gemini) return gemini;
  } catch (error) {
    console.warn("Gemini nutrition fallback:", error.message);
  }

  const items = estimateNutrition({ text: description, source, imageName });
  return { items, totals: sumItems(items), provider: "heuristic-fallback" };
};

const generateAiDashboard = async ({ profile, summary, logs }) => {
  const fallback = {
    insights: buildInsights(profile, summary),
    alerts: buildAlerts(profile, summary),
    mealSuggestions: buildSuggestions(profile, summary)
  };

  try {
    const payload = await callGemini({
      systemInstruction:
        "You are a nutrition coach. Return only valid JSON. Keep messages concise, actionable, and safe. Do not mention being an AI.",
      parts: [
        {
          text: JSON.stringify({
            task: "Generate dashboard insights, alerts, and meal suggestions",
            profile: {
              goal: profile.primaryGoal,
              medicalConditions: profile.medicalConditions || [],
              dietaryRestrictions: profile.dietaryRestrictions || [],
              allergies: profile.allergies || [],
              dailyGoals: profile.dailyGoals || {}
            },
            summary,
            logs: logs.map((log) => ({
              description: log.description,
              mealType: log.mealType,
              totals: log.totals,
              loggedAt: log.loggedAt
            })),
            responseShape: {
              insights: {
                score: "number",
                summary: "string",
                macroAnalysis: ["string"],
                recommendations: ["string"]
              },
              alerts: [{ severity: "low|medium|high", title: "string", message: "string" }],
              mealSuggestions: [{ title: "string", reason: "string" }]
            }
          })
        }
      ]
    });

    return {
      insights: {
        ...(payload?.insights || fallback.insights),
        provider: "gemini"
      },
      alerts: Array.isArray(payload?.alerts) && payload.alerts.length ? payload.alerts : fallback.alerts,
      alertsProvider: "gemini",
      mealSuggestions:
        Array.isArray(payload?.mealSuggestions) && payload.mealSuggestions.length
          ? payload.mealSuggestions
          : fallback.mealSuggestions,
      suggestionsProvider: "gemini"
    };
  } catch (error) {
    console.warn("Gemini dashboard fallback:", error.message);
    return {
      insights: { ...fallback.insights, provider: "heuristic-fallback" },
      alerts: fallback.alerts,
      alertsProvider: "heuristic-fallback",
      mealSuggestions: fallback.mealSuggestions,
      suggestionsProvider: "heuristic-fallback"
    };
  }
};

const generateVoiceReply = async ({ message, profile, summary, logs }) => {
  try {
    const text = await callGemini({
      systemInstruction:
        "You are Nutri Vision's spoken nutrition assistant. Answer in at most 2 short sentences. No markdown.",
      parts: [
        {
          text: JSON.stringify({
            userMessage: message,
            profile: {
              name: profile.name,
              goal: profile.primaryGoal,
              dailyGoals: profile.dailyGoals,
              medicalConditions: profile.medicalConditions || [],
              dietaryRestrictions: profile.dietaryRestrictions || []
            },
            summary,
            recentMeals: logs.slice(0, 6).map((log) => ({
              description: log.description,
              mealType: log.mealType,
              totals: log.totals
            }))
          })
        }
      ],
      responseMimeType: "text/plain"
    });

    if (typeof text === "string" && text.trim()) return text.trim();
    return buildVoiceReply(message, { profile, summary });
  } catch (error) {
    console.warn("Gemini voice fallback:", error.message);
    return buildVoiceReply(message, { profile, summary });
  }
};

module.exports = { analyzeNutrition, generateAiDashboard, generateVoiceReply };
