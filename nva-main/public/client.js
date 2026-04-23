const state = {
  session: loadSession(),
  profile: null,
  dashboard: null,
  onboardingStep: 1,
  foodRecognition: null,
  assistantRecognition: null
};

document.addEventListener("DOMContentLoaded", () => {
  bindLogoutButtons();
  const page = document.body.dataset.page;
  if (page === "landing") initLanding();
  if (page === "auth") initAuth();
  if (page === "onboarding") initOnboarding();
  if (page === "dashboard") initDashboard();
  if (page === "profile") initProfile();
  if (page === "settings") initSettings();
});

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem("nv_session") || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  state.session = session;
  localStorage.setItem("nv_session", JSON.stringify(session));
}

function clearSession() {
  state.session = null;
  state.profile = null;
  localStorage.removeItem("nv_session");
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (state.session?.token) headers.Authorization = `Bearer ${state.session.token}`;

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.details || "Request failed");
  return data;
}

function notify(message) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function commaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fillNav(profile) {
  const line = document.getElementById("nav-user-line");
  if (line && profile) line.textContent = `${profile.name} • ${profile.email}`;
}

async function ensureAuthenticated({ allowIncomplete = false } = {}) {
  if (!state.session?.token) {
    window.location.href = "/auth";
    return null;
  }
  try {
    const data = await api("/api/auth/me");
    state.profile = data.profile;
    saveSession({ token: state.session.token, profile: data.profile });
    fillNav(data.profile);
    if (!allowIncomplete && !data.profile.onboardingComplete) {
      window.location.href = "/onboarding";
      return null;
    }
    return data.profile;
  } catch (error) {
    clearSession();
    window.location.href = "/auth";
    return null;
  }
}

function bindLogoutButtons() {
  document.querySelectorAll("#logout-btn-top").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (state.session?.token) await api("/api/auth/logout", { method: "POST" });
      } catch {}
      clearSession();
      window.location.href = "/auth";
    });
  });
}

function initLanding() {
  if (state.session?.token) {
    api("/api/auth/me")
      .then((data) => {
        if (data.profile.onboardingComplete) {
          document.querySelectorAll('a[href="/auth"]').forEach((link) => {
            link.setAttribute("href", "/dashboard");
            link.textContent = "Open Dashboard";
          });
        }
      })
      .catch(() => {});
  }
}

function initAuth() {
  if (state.session?.token) {
    api("/api/auth/me")
      .then((data) => {
        window.location.href = data.profile.onboardingComplete ? "/dashboard" : "/onboarding";
      })
      .catch(() => clearSession());
  }

  const loginTab = document.querySelector('[data-auth-tab="login"]');
  const signupTab = document.querySelector('[data-auth-tab="signup"]');
  const loginPanel = document.getElementById("auth-login-panel");
  const signupPanel = document.getElementById("auth-signup-panel");

  const setTab = (tab) => {
    loginTab.classList.toggle("active", tab === "login");
    signupTab.classList.toggle("active", tab === "signup");
    loginPanel.classList.toggle("active", tab === "login");
    signupPanel.classList.toggle("active", tab === "signup");
  };

  loginTab.addEventListener("click", () => setTab("login"));
  signupTab.addEventListener("click", () => setTab("signup"));

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });
      saveSession({ token: data.token, profile: data.profile });
      window.location.href = data.profile.onboardingComplete ? "/dashboard" : "/onboarding";
    } catch (error) {
      notify(error.message);
    }
  });

  document.getElementById("signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password")
        })
      });
      saveSession({ token: data.token, profile: data.profile });
      window.location.href = "/onboarding";
    } catch (error) {
      notify(error.message);
    }
  });
}

async function initOnboarding() {
  const profile = await ensureAuthenticated({ allowIncomplete: true });
  if (!profile) return;
  if (profile.onboardingComplete) {
    window.location.href = "/dashboard";
    return;
  }

  const stepPill = document.getElementById("onboarding-step-pill");
  const backBtn = document.getElementById("onboarding-back");
  const nextBtn = document.getElementById("onboarding-next");
  const submitBtn = document.getElementById("onboarding-submit");
  const sections = Array.from(document.querySelectorAll("[data-step]"));

  const renderStep = () => {
    sections.forEach((section) => {
      section.classList.toggle("hidden", Number(section.dataset.step) !== state.onboardingStep);
    });
    stepPill.textContent = `Step ${state.onboardingStep} of 2`;
    backBtn.classList.toggle("hidden", state.onboardingStep === 1);
    nextBtn.classList.toggle("hidden", state.onboardingStep === 2);
    submitBtn.classList.toggle("hidden", state.onboardingStep !== 2);
  };

  nextBtn.addEventListener("click", () => {
    state.onboardingStep = 2;
    renderStep();
  });
  backBtn.addEventListener("click", () => {
    state.onboardingStep = 1;
    renderStep();
  });

  document.getElementById("onboarding-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/profile/onboarding", {
        method: "PUT",
        body: JSON.stringify({
          age: Number(form.get("age")),
          gender: form.get("gender"),
          activityLevel: form.get("activityLevel"),
          primaryGoal: form.get("primaryGoal"),
          medicalConditions: commaList(form.get("medicalConditions")),
          dietaryRestrictions: commaList(form.get("dietaryRestrictions")),
          allergies: commaList(form.get("allergies"))
        })
      });
      saveSession({ token: state.session.token, profile: data.profile });
      notify("Onboarding complete");
      window.location.href = "/dashboard";
    } catch (error) {
      notify(error.message);
    }
  });

  renderStep();
}

async function initDashboard() {
  const profile = await ensureAuthenticated();
  if (!profile) return;

  const foodTabs = document.querySelectorAll(".food-tab");
  foodTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      foodTabs.forEach((button) => button.classList.toggle("active", button === tab));
      document.querySelectorAll(".food-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `food-panel-${tab.dataset.foodTab}`);
      });
    });
  });

  document.getElementById("dashboard-date-pill").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  });

  document.getElementById("text-log-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/food-logs", {
        method: "POST",
        body: JSON.stringify({
          description: form.get("description"),
          mealType: form.get("mealType"),
          source: "text"
        })
      });
      event.currentTarget.reset();
      notify("Meal logged");
      await loadDashboard();
    } catch (error) {
      notify(error.message);
    }
  });

  setupVoiceLogging();
  setupImageLogging();
  setupWaterButtons();
  setupAssistant();

  await loadDashboard();
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  state.dashboard = data;
  renderDashboard(data);
}

function renderDashboard(data) {
  const { summary, trend, alerts, mealSuggestions, insights, providers } = data;
  const profile = state.profile;

  document.getElementById("dashboard-greeting").textContent = `Welcome back, ${profile.name}`;
  document.getElementById("dashboard-subtitle").textContent = `You have logged ${summary.mealsLogged} meal${summary.mealsLogged === 1 ? "" : "s"} today.`;

  setMetric("calories", summary.totals.calories, summary.goals.calories, "");
  setMetric("protein", summary.totals.protein, summary.goals.protein, " g");
  setMetric("carbs", summary.totals.carbs, summary.goals.carbs, " g");
  setMetric("fat", summary.totals.fat, summary.goals.fat, " g");

  document.getElementById("water-count").textContent = summary.water;
  document.getElementById("water-target-label").textContent = `of ${summary.goals.water} glasses`;
  document.getElementById("food-provider-pill").textContent = `Latest food analysis: ${providers?.recentFoodLogs?.[0]?.provider || "unknown"}`;
  document.getElementById("insights-provider-line").textContent = `Provider: ${providers?.insights || "unknown"}`;
  document.getElementById("alerts-provider-line").textContent = `Provider: ${providers?.alerts || "unknown"}`;
  document.getElementById("suggestions-provider-line").textContent = `Provider: ${providers?.mealSuggestions || "unknown"}`;

  const trendBars = document.getElementById("trend-bars");
  const maxCalories = Math.max(...trend.map((item) => item.calories), 1);
  trendBars.innerHTML = trend
    .map((item) => {
      const height = Math.max(16, Math.round((item.calories / maxCalories) * 180));
      return `<div class="bar-col"><small>${item.calories}</small><div class="bar" style="height:${height}px"></div><div class="bar-label">${item.label}</div></div>`;
    })
    .join("");

  renderNoticeList("alert-list", alerts);
  renderSimpleList("suggestion-list", mealSuggestions.map((item) => ({ title: item.title, text: item.reason })));
  renderSimpleList(
    "recent-meals-list",
    summary.recentMeals.map((meal) => ({
      title: meal.description,
      text: `${meal.calories} kcal • ${new Date(meal.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    })),
    "No meals logged yet."
  );

  document.getElementById("insight-score").textContent = `${insights.score}/100`;
  document.getElementById("insight-summary").textContent = insights.summary;
  const recentMealsRoot = document.getElementById("recent-meals-list");
  if (recentMealsRoot && summary.recentMeals.length) {
    recentMealsRoot.innerHTML = summary.recentMeals
      .map((meal) => {
        const provider = providers?.recentFoodLogs?.find((item) => item.id === meal.id)?.provider || "manual";
        return `<div class="list-item"><strong>${meal.description}</strong><small>${meal.calories} kcal | ${new Date(meal.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} | ${provider}</small></div>`;
      })
      .join("");
  }
  renderSimpleList(
    "insight-list",
    [...insights.macroAnalysis, ...insights.recommendations].map((text) => ({ title: text, text: "" })),
    "No insights yet."
  );
}

function setMetric(prefix, value, goal, suffix) {
  document.getElementById(`metric-${prefix}`).textContent = `${value}${suffix}`;
  document.getElementById(`${prefix}-goal-label`).textContent = `${value} / ${goal}`;
  document.getElementById(`progress-${prefix}`).style.width = `${goal ? Math.min(100, Math.round((value / goal) * 100)) : 0}%`;
}

function renderNoticeList(id, items) {
  const root = document.getElementById(id);
  root.innerHTML = items
    .map((item) => `<div class="notice ${item.severity}"><strong>${item.title}</strong><div>${item.message}</div></div>`)
    .join("");
}

function renderSimpleList(id, items, empty = "Nothing to show yet.") {
  const root = document.getElementById(id);
  if (!items.length) {
    root.innerHTML = `<div class="list-item">${empty}</div>`;
    return;
  }
  root.innerHTML = items
    .map((item) => `<div class="list-item"><strong>${item.title}</strong>${item.text ? `<small>${item.text}</small>` : ""}</div>`)
    .join("");
}

function setupVoiceLogging() {
  const transcript = document.getElementById("voice-transcript");
  const startBtn = document.getElementById("voice-start-btn");
  const stopBtn = document.getElementById("voice-stop-btn");
  const logBtn = document.getElementById("voice-log-btn");
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    transcript.value = "Speech recognition is not supported in this browser.";
    return;
  }

  state.foodRecognition = new Recognition();
  state.foodRecognition.lang = "en-US";
  state.foodRecognition.interimResults = true;
  state.foodRecognition.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i += 1) {
      text += `${event.results[i][0].transcript} `;
    }
    transcript.value = text.trim();
  };

  startBtn.addEventListener("click", () => state.foodRecognition.start());
  stopBtn.addEventListener("click", () => state.foodRecognition.stop());
  logBtn.addEventListener("click", async () => {
    try {
      await api("/api/food-logs", {
        method: "POST",
        body: JSON.stringify({
          description: transcript.value,
          mealType: "meal",
          source: "voice"
        })
      });
      transcript.value = "";
      notify("Voice meal logged");
      await loadDashboard();
    } catch (error) {
      notify(error.message);
    }
  });
}

function setupImageLogging() {
  const fileInput = document.getElementById("image-file");
  const preview = document.getElementById("image-preview");
  const caption = document.getElementById("image-caption");
  let fileName = "";
  let imageData = "";
  let imageMimeType = "";

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    fileName = file ? file.name : "";
    if (!file) {
      imageData = "";
      imageMimeType = "";
      preview.classList.add("hidden");
      preview.textContent = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, encoded = ""] = result.split(",");
      imageData = encoded;
      imageMimeType = file.type || "image/jpeg";
      preview.classList.remove("hidden");
      preview.textContent = `Selected image: ${fileName}`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("image-log-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/food-logs", {
        method: "POST",
        body: JSON.stringify({
          description: caption.value || fileName || "Image meal",
          imageName: fileName,
          imageData,
          imageMimeType,
          mealType: "meal",
          source: "image"
        })
      });
      event.currentTarget.reset();
      imageData = "";
      imageMimeType = "";
      preview.classList.add("hidden");
      preview.textContent = "";
      notify("Image meal logged");
      await loadDashboard();
    } catch (error) {
      notify(error.message);
    }
  });
}

function setupWaterButtons() {
  document.getElementById("water-add-btn").addEventListener("click", async () => {
    await api("/api/water", { method: "POST", body: JSON.stringify({ delta: 1 }) });
    await loadDashboard();
  });
  document.getElementById("water-remove-btn").addEventListener("click", async () => {
    await api("/api/water", { method: "POST", body: JSON.stringify({ delta: -1 }) });
    await loadDashboard();
  });
}

function setupAssistant() {
  const panel = document.getElementById("assistant-panel");
  const openBtn = document.getElementById("assistant-open-btn");
  const closeBtn = document.getElementById("assistant-close-btn");
  const sendBtn = document.getElementById("assistant-send-btn");
  const micBtn = document.getElementById("assistant-mic-btn");
  const input = document.getElementById("assistant-input");
  const thread = document.getElementById("assistant-thread");
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const append = (text, kind) => {
    const node = document.createElement("div");
    node.className = kind === "user" ? "assistant-user" : "assistant-response";
    node.textContent = text;
    thread.appendChild(node);
    thread.scrollTop = thread.scrollHeight;
  };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const send = async (message) => {
    if (!message.trim()) return;
    append(message, "user");
    input.value = "";
    try {
      const data = await api("/api/voice-chat", {
        method: "POST",
        body: JSON.stringify({ message })
      });
      append(data.reply, "bot");
      speak(data.reply);
    } catch (error) {
      append(error.message, "bot");
    }
  };

  openBtn.addEventListener("click", () => panel.classList.add("open"));
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));
  sendBtn.addEventListener("click", () => send(input.value));

  if (Recognition) {
    state.assistantRecognition = new Recognition();
    state.assistantRecognition.lang = "en-US";
    state.assistantRecognition.onresult = (event) => {
      input.value = event.results[0][0].transcript;
      send(input.value);
    };
    micBtn.addEventListener("click", () => state.assistantRecognition.start());
  } else {
    micBtn.disabled = true;
  }
}

async function initProfile() {
  const profile = await ensureAuthenticated();
  if (!profile) return;
  fillProfileForm(profile);

  document.getElementById("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: document.getElementById("profile-name").value,
          age: Number(document.getElementById("profile-age").value) || null,
          gender: document.getElementById("profile-gender").value,
          activityLevel: document.getElementById("profile-activity").value,
          primaryGoal: document.getElementById("profile-goal").value,
          medicalConditions: commaList(document.getElementById("profile-medical").value),
          dietaryRestrictions: commaList(document.getElementById("profile-restrictions").value),
          allergies: commaList(document.getElementById("profile-allergies").value),
          dailyGoals: {
            calories: Number(document.getElementById("goal-calories").value),
            protein: Number(document.getElementById("goal-protein").value),
            carbs: Number(document.getElementById("goal-carbs").value),
            fat: Number(document.getElementById("goal-fat").value),
            water: Number(document.getElementById("goal-water").value)
          }
        })
      });
      state.profile = data.profile;
      saveSession({ token: state.session.token, profile: data.profile });
      fillProfileForm(data.profile);
      fillNav(data.profile);
      notify("Profile saved");
    } catch (error) {
      notify(error.message);
    }
  });
}

function fillProfileForm(profile) {
  fillNav(profile);
  document.getElementById("profile-name").value = profile.name || "";
  document.getElementById("profile-age").value = profile.age || "";
  document.getElementById("profile-gender").value = profile.gender || "";
  document.getElementById("profile-activity").value = profile.activityLevel || "moderate";
  document.getElementById("profile-goal").value = profile.primaryGoal || "wellness";
  document.getElementById("profile-medical").value = (profile.medicalConditions || []).join(", ");
  document.getElementById("profile-restrictions").value = (profile.dietaryRestrictions || []).join(", ");
  document.getElementById("profile-allergies").value = (profile.allergies || []).join(", ");
  document.getElementById("goal-calories").value = profile.dailyGoals?.calories || 2200;
  document.getElementById("goal-protein").value = profile.dailyGoals?.protein || 140;
  document.getElementById("goal-carbs").value = profile.dailyGoals?.carbs || 250;
  document.getElementById("goal-fat").value = profile.dailyGoals?.fat || 70;
  document.getElementById("goal-water").value = profile.dailyGoals?.water || 8;
}

async function initSettings() {
  const profile = await ensureAuthenticated();
  if (!profile) return;
  fillNav(profile);
  fillSettings(profile.settings || {});

  document.getElementById("settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("/api/profile/settings", {
        method: "PUT",
        body: JSON.stringify({
          notifications: {
            mealReminders: document.getElementById("setting-meal-reminders").checked,
            medicationAlerts: document.getElementById("setting-medication-alerts").checked,
            healthInsights: document.getElementById("setting-health-insights").checked
          },
          privacy: {
            shareWithProviders: document.getElementById("setting-share-providers").checked,
            anonymousAnalytics: document.getElementById("setting-analytics").checked,
            dataRetention: document.getElementById("setting-retention").value,
            encryptionLevel: document.getElementById("setting-encryption").value
          },
          accessibility: {
            highContrast: document.getElementById("setting-high-contrast").checked,
            largeText: document.getElementById("setting-large-text").checked,
            screenReader: document.getElementById("setting-screen-reader").checked
          }
        })
      });
      state.profile = data.profile;
      saveSession({ token: state.session.token, profile: data.profile });
      notify("Settings saved");
    } catch (error) {
      notify(error.message);
    }
  });
}

function fillSettings(settings) {
  document.getElementById("setting-meal-reminders").checked = settings.notifications?.mealReminders ?? true;
  document.getElementById("setting-medication-alerts").checked = settings.notifications?.medicationAlerts ?? true;
  document.getElementById("setting-health-insights").checked = settings.notifications?.healthInsights ?? true;
  document.getElementById("setting-share-providers").checked = settings.privacy?.shareWithProviders ?? false;
  document.getElementById("setting-analytics").checked = settings.privacy?.anonymousAnalytics ?? true;
  document.getElementById("setting-retention").value = settings.privacy?.dataRetention || "2-years";
  document.getElementById("setting-encryption").value = settings.privacy?.encryptionLevel || "maximum";
  document.getElementById("setting-high-contrast").checked = settings.accessibility?.highContrast ?? false;
  document.getElementById("setting-large-text").checked = settings.accessibility?.largeText ?? false;
  document.getElementById("setting-screen-reader").checked = settings.accessibility?.screenReader ?? false;
}
