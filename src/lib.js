/* ---------------- fitness engine ---------------- */
export const ACTIVITY = [
  { id: "sedentary", label: "Mostly seated", mult: 1.2 },
  { id: "light", label: "Light activity", mult: 1.375 },
  { id: "moderate", label: "Active most days", mult: 1.55 },
  { id: "high", label: "Very active", mult: 1.725 },
];
export const GOALS = [
  { id: "lose", label: "Lose fat", adj: -450, tag: "CUT" },
  { id: "maintain", label: "Maintain", adj: 0, tag: "HOLD" },
  { id: "gain", label: "Build muscle", adj: 350, tag: "BUILD" },
];

export function computeTargets(p) {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  const bmr = Math.round(p.sex === "male" ? base + 5 : base - 161);
  const mult = (ACTIVITY.find((a) => a.id === p.activity) || ACTIVITY[1]).mult;
  const tdee = Math.round(bmr * mult);
  const adj = (GOALS.find((g) => g.id === p.goal) || GOALS[1]).adj;
  const kcal = Math.max(1200, tdee + adj);
  const protein = Math.round(p.weight * (p.goal === "lose" ? 1.8 : 1.6));
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr, tdee, kcal, protein, carbs, fat };
}

/* ---------------- dates ---------------- */
export const dayISO = (d = new Date()) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
export const shiftISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayISO(d); };
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const todayName = () => DOW[new Date().getDay()];
export const fmtHeader = () => {
  const d = new Date();
  return `${DOW[d.getDay()].toUpperCase()} ${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en", { month: "short" }).toUpperCase()}`;
};
export const nowHM = () => new Date().toTimeString().slice(0, 5);

/* ---------------- storage ---------------- */
const STORE_KEY = "pulsecoach_state_v2";
const LENS_KEY = "pulselens_log_v1";

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.profile) return migrateLens(s);
  } catch { }
  return null;
}
export function saveState(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { } }
export function clearState() { try { localStorage.removeItem(STORE_KEY); } catch { } }

/* Fold any scans logged by the old Lens-only app into the journal, once. */
export function migrateLens(state) {
  let lens;
  try { lens = JSON.parse(localStorage.getItem(LENS_KEY)); } catch { }
  if (!lens) return state;
  const journal = { ...state.journal };
  for (const [iso, entries] of Object.entries(lens)) {
    if (!Array.isArray(entries)) continue;
    const day = journal[iso] || { foods: [], workouts: [], checkins: {} };
    const have = new Set(day.foods.map((f) => f.id));
    const foods = [...day.foods];
    for (const e of entries) {
      if (have.has(e.id)) continue;
      const h = +String(e.at || "12").slice(0, 2);
      const meal = h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snack";
      foods.push({ id: e.id, meal, name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f });
    }
    journal[iso] = { ...day, foods };
  }
  try { localStorage.removeItem(LENS_KEY); } catch { }
  return { ...state, journal };
}

/* ---------------- API client (Vercel functions) ---------------- */
async function post(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "request_failed");
  return data;
}

export async function apiAnalyzePhoto(dataUrl) {
  return post("/api/analyze-food", { image: dataUrl.split(",")[1], media_type: "image/jpeg" });
}
export async function apiPlan(profile, targets) {
  const plan = await post("/api/coach", { kind: "plan", profile, targets });
  return { ...plan, source: "ai" };
}
export async function apiFood(desc, meal) {
  const j = await post("/api/coach", { kind: "food", desc, meal });
  return { name: String(j.name || desc).slice(0, 48), kcal: Math.round(+j.kcal || 0), p: Math.round(+j.protein || 0), c: Math.round(+j.carbs || 0), f: Math.round(+j.fat || 0), est: false };
}
export async function apiChat(context, messages) {
  const { reply } = await post("/api/coach", { kind: "chat", context, messages });
  return reply || "…";
}

/* Downscale a photo to a JPEG data URL so uploads stay small and cheap. */
export function fileToJpeg(file, maxEdge = 1568) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}

/* ---------------- fallback plan (when the AI is unreachable) ---------------- */
export function fallbackPlan(profile, targets) {
  const push = { focus: "Push strength", work: [{ n: "Incline push-up / bench", d: "4 x 8-10" }, { n: "Shoulder press", d: "3 x 10" }, { n: "Triceps dips", d: "3 x 12" }] };
  const pull = { focus: "Pull strength", work: [{ n: "Rows", d: "4 x 8-10" }, { n: "Lat pulldown / band pull", d: "3 x 10" }, { n: "Biceps curl", d: "3 x 12" }] };
  const legs = { focus: "Legs + core", work: [{ n: "Goblet squat", d: "4 x 10" }, { n: "Romanian deadlift", d: "3 x 10" }, { n: "Plank", d: "3 x 45s" }] };
  const cond = { focus: "Conditioning", work: [{ n: "Brisk walk / jog", d: "30-40 min Z2" }, { n: "Mobility flow", d: "10 min" }] };
  const rest = { focus: "Recovery", work: [{ n: "Easy walk", d: "20 min" }, { n: "Stretching", d: "10 min" }] };
  const seq = profile.days >= 5 ? [push, pull, legs, cond, push, rest, rest]
    : profile.days === 4 ? [push, pull, rest, legs, cond, rest, rest]
      : [push, rest, pull, rest, legs, rest, rest];
  return {
    summary: `A ${profile.days}-day ${(GOALS.find((g) => g.id === profile.goal) || GOALS[1]).label.toLowerCase()} split built around ${targets.kcal} kcal and ${targets.protein} g protein per day.`,
    week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({ day, ...seq[i] })),
    tips: [
      `Anchor each meal around protein — aim for roughly ${Math.round(targets.protein / 4)} g per meal.`,
      "Log food before you eat it, not after. Decisions beat memories.",
      "Two poor days never ruin a week. Just make the next log a good one.",
    ],
    source: "template",
  };
}

/* ---------------- demo seed ---------------- */
export function seedDemo() {
  const profile = { name: "Alex Tan", age: 32, sex: "male", height: 173, weight: 78, activity: "light", goal: "lose", days: 4 };
  const targets = computeTargets(profile);
  const journal = {};
  const w0 = 79.6;
  for (let i = 9; i >= 1; i--) {
    const iso = shiftISO(-i);
    const weight = +(w0 - (9 - i) * 0.18 + (i % 3 === 0 ? 0.15 : -0.05)).toFixed(1);
    journal[iso] = {
      weight,
      foods: [
        { id: iso + "f1", meal: "breakfast", name: "Kaya toast + kopi C", kcal: 380, p: 9, c: 52, f: 15 },
        { id: iso + "f2", meal: "lunch", name: "Chicken rice (small)", kcal: 610, p: 32, c: 68, f: 22 },
        { id: iso + "f3", meal: "dinner", name: "Fish soup with rice", kcal: 450, p: 34, c: 50, f: 10 },
      ],
      workouts: i % 2 === 0 ? [{ id: iso + "w1", name: "Plan session", mins: 45 }] : [],
      checkins: {
        morning: { weight, sleep: 3 + (i % 3), energy: 3, at: "08:0" + (i % 6) },
        midday: { mood: 3 + (i % 2), water: 4 + (i % 4), at: "14:1" + (i % 6) },
        ...(i % 4 !== 1 ? { evening: { rating: 4, onPlan: i % 3 !== 0, at: "22:0" + (i % 6) } } : {}),
      },
    };
  }
  const today = dayISO();
  journal[today] = {
    weight: 77.9,
    foods: [{ id: today + "f1", meal: "breakfast", name: "2 eggs + wholemeal toast", kcal: 320, p: 20, c: 28, f: 14 }],
    workouts: [],
    checkins: { morning: { weight: 77.9, sleep: 4, energy: 4, at: "07:58" } },
  };
  return { profile, targets, plan: fallbackPlan(profile, targets), journal, chat: [], created: Date.now() };
}
