const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    notifications: {
      mealReminders: { type: Boolean, default: true },
      medicationAlerts: { type: Boolean, default: true },
      healthInsights: { type: Boolean, default: true }
    },
    privacy: {
      shareWithProviders: { type: Boolean, default: false },
      anonymousAnalytics: { type: Boolean, default: true },
      dataRetention: { type: String, default: "2-years" },
      encryptionLevel: { type: String, default: "maximum" }
    },
    accessibility: {
      highContrast: { type: Boolean, default: false },
      largeText: { type: Boolean, default: false },
      screenReader: { type: Boolean, default: false }
    }
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    age: { type: Number, min: 1, max: 120, default: null },
    gender: { type: String, trim: true, default: "" },
    activityLevel: { type: String, trim: true, default: "moderate" },
    primaryGoal: { type: String, trim: true, default: "wellness" },
    medicalConditions: [{ type: String, trim: true }],
    dietaryRestrictions: [{ type: String, trim: true }],
    allergies: [{ type: String, trim: true }],
    onboardingComplete: { type: Boolean, default: false },
    dailyGoals: {
      calories: { type: Number, min: 0, default: 2200 },
      protein: { type: Number, min: 0, default: 140 },
      carbs: { type: Number, min: 0, default: 250 },
      fat: { type: Number, min: 0, default: 70 },
      water: { type: Number, min: 0, default: 8 }
    },
    settings: { type: settingsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

const foodItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0, default: 1 },
    unit: { type: String, trim: true, default: "serving" },
    calories: { type: Number, min: 0, default: 0 },
    protein: { type: Number, min: 0, default: 0 },
    carbs: { type: Number, min: 0, default: 0 },
    fat: { type: Number, min: 0, default: 0 },
    fiber: { type: Number, min: 0, default: 0 },
    sugar: { type: Number, min: 0, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0.65 }
  },
  { _id: false }
);

const foodLogSchema = new mongoose.Schema(
  {
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    description: { type: String, required: true, trim: true },
    mealType: { type: String, trim: true, default: "meal" },
    source: { type: String, trim: true, default: "text" },
    analysisProvider: { type: String, trim: true, default: "manual" },
    items: { type: [foodItemSchema], default: [] },
    totals: {
      calories: { type: Number, min: 0, default: 0 },
      protein: { type: Number, min: 0, default: 0 },
      carbs: { type: Number, min: 0, default: 0 },
      fat: { type: Number, min: 0, default: 0 },
      fiber: { type: Number, min: 0, default: 0 },
      sugar: { type: Number, min: 0, default: 0 }
    },
    notes: { type: String, trim: true, default: "" },
    imageName: { type: String, trim: true, default: "" },
    loggedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

const dailyStatSchema = new mongoose.Schema(
  {
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    date: { type: String, required: true, trim: true },
    waterGlasses: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

dailyStatSchema.index({ profileId: 1, date: 1 }, { unique: true });

const sessionSchema = new mongoose.Schema(
  {
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

const Profile = mongoose.model("Profile", profileSchema);
const FoodLog = mongoose.model("FoodLog", foodLogSchema);
const DailyStat = mongoose.model("DailyStat", dailyStatSchema);
const Session = mongoose.model("Session", sessionSchema);

module.exports = { Profile, FoodLog, DailyStat, Session };
