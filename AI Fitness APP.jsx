import React, { useState, useEffect, useMemo, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  Flame, Plus, Trash2, Send, Sparkles, RefreshCw, ChevronRight, Check, Lock,
  Utensils, Dumbbell, MessageCircle, LayoutGrid, RotateCcw, Loader2, AlertTriangle,
  Moon, Droplets, Zap, Sun, CalendarDays, User, ArrowRight, Camera, KeyRound
} from "lucide-react";

/* ================================================================
   PULSECOACH — AI Fitness Advisor (MVP)
   Zone-based design system: Z1 recovery blue -> Z5 max red.
   Single-file React MVP: onboarding + BMR/TDEE engine, AI plan,
   3x daily check-ins, food/workout logging, AI coach chat,
   trainer console. Persists via window.storage (memory fallback).
   ================================================================ */

const C = {
  chalk: "#F2F3EF",
  card: "#FFFFFF",
  iron: "#1F2823",
  iron2: "#2A352E",
  ink: "#232B26",
  smoke: "#6C766E",
  faint: "#9AA39B",
  line: "#E2E6DF",
  z1: "#4E7CB8", // recovery / weight / sleep
  z2: "#3E9B6E", // adherence / nutrition-good
  z3: "#D9A62E", // fuel / calories
  z4: "#DE7130", // training
  z5: "#C44536", // alerts / over
};

const ZONE_TAG = {
  z1: "Z1 · RECOVERY",
  z2: "Z2 · STEADY",
  z3: "Z3 · FUEL",
  z4: "Z4 · TRAINING",
  z5: "Z5 · ALERT",
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.pc-root{font-family:'Barlow',system-ui,-apple-system,'Segoe UI',sans-serif;color:${C.ink};}
.pc-display{font-family:'Barlow Condensed','Arial Narrow',system-ui,sans-serif;}
.pc-mono{font-family:'IBM Plex Mono',ui-monospace,'Courier New',monospace;}
.pc-root ::selection{background:${C.z3}55;}
.pc-root button{cursor:pointer;}
.pc-root button:focus-visible, .pc-root input:focus-visible, .pc-root textarea:focus-visible{outline:2px solid ${C.z4};outline-offset:2px;border-radius:6px;}
.pc-fade{animation:pcFade .35s ease both;}
@keyframes pcFade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
.pc-pulse{animation:pcPulse 1.4s ease-in-out infinite;}
@keyframes pcPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
.pc-chat::-webkit-scrollbar{width:6px;}
.pc-chat::-webkit-scrollbar-thumb{background:${C.line};border-radius:3px;}
@media (prefers-reduced-motion: reduce){.pc-fade,.pc-pulse{animation:none;}}
`;

/* ---------------- storage (window.storage w/ memory fallback) ---------------- */
const MEM = {};
const STORE_KEY = "pulsecoach:v1";
async function loadState() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(STORE_KEY);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) { /* key missing or storage unavailable */ }
  return MEM[STORE_KEY] ? JSON.parse(MEM[STORE_KEY]) : null;
}
async function saveState(state) {
  const s = JSON.stringify(state);
  MEM[STORE_KEY] = s;
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(STORE_KEY, s);
    }
  } catch (e) { /* fall back to memory only */ }
}
async function clearState() {
  delete MEM[STORE_KEY];
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.delete(STORE_KEY);
    }
  } catch (e) { /* ignore */ }
}

/* ---------------- fitness engine ---------------- */
const ACTIVITY = [
  { id: "sedentary", label: "Mostly seated", mult: 1.2 },
  { id: "light", label: "Light activity", mult: 1.375 },
  { id: "moderate", label: "Active most days", mult: 1.55 },
  { id: "high", label: "Very active", mult: 1.725 },
];
const GOALS = [
  { id: "lose", label: "Lose fat", adj: -450, tag: "CUT" },
  { id: "maintain", label: "Maintain", adj: 0, tag: "HOLD" },
  { id: "gain", label: "Build muscle", adj: 350, tag: "BUILD" },
];

function computeTargets(p) {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  const bmr = Math.round(p.sex === "male" ? base + 5 : base - 161);
  const mult = (ACTIVITY.find(a => a.id === p.activity) || ACTIVITY[1]).mult;
  const tdee = Math.round(bmr * mult);
  const adj = (GOALS.find(g => g.id === p.goal) || GOALS[1]).adj;
  const kcal = Math.max(1200, tdee + adj);
  const protein = Math.round(p.weight * (p.goal === "lose" ? 1.8 : 1.6));
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr, tdee, kcal, protein, carbs, fat };
}

/* ---------------- date helpers ---------------- */
const dayISO = (d = new Date()) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const shiftISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayISO(d); };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtHeader = () => {
  const d = new Date();
  return `${DOW[d.getDay()].toUpperCase()} ${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en", { month: "short" }).toUpperCase()}`;
};

/* ---------------- Claude API ---------------- */
const API_KEY_STORE = "pulsecoach_api_key_v1";
const getApiKey = () => { try { return localStorage.getItem(API_KEY_STORE) || ""; } catch { return ""; } };
const setApiKey = (k) => { try { k ? localStorage.setItem(API_KEY_STORE, k) : localStorage.removeItem(API_KEY_STORE); } catch { } };

async function claudeFetch(body) {
  const headers = { "Content-Type": "application/json" };
  const key = getApiKey();
  if (key) {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}

async function askClaude(messages) {
  return claudeFetch({ model: "claude-sonnet-4-6", max_tokens: 1000, messages });
}

/* Downscale a photo to a JPEG data URL so requests stay small and cheap. */
function fileToJpegDataUrl(file, maxEdge = 1568) {
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

const FOOD_PHOTO_SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean", description: "true only if the photo shows food or drink" },
    name: { type: "string", description: "short dish name, max 48 chars; combine multiple items like 'Chicken rice + iced tea'" },
    kcal: { type: "integer" },
    protein: { type: "integer" },
    carbs: { type: "integer" },
    fat: { type: "integer" },
  },
  required: ["is_food", "name", "kcal", "protein", "carbs", "fat"],
  additionalProperties: false,
};

async function aiFoodPhoto(dataUrl, meal) {
  const b64 = dataUrl.split(",")[1];
  const text = await claudeFetch({
    model: "claude-opus-4-8",
    max_tokens: 1000,
    output_config: { format: { type: "json_schema", schema: FOOD_PHOTO_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: `Identify the food/drink in this photo and estimate total nutrition for the visible portion size (Singapore context if ambiguous). This is a ${meal} entry. If several items are visible, combine them into one entry. If the photo contains no food or drink, set is_food to false.` },
      ],
    }],
  });
  const j = extractJSON(text);
  if (!j.is_food) throw new Error("not_food");
  return { name: String(j.name || "Photo meal").slice(0, 48), kcal: Math.round(+j.kcal || 0), p: Math.round(+j.protein || 0), c: Math.round(+j.carbs || 0), f: Math.round(+j.fat || 0), est: false };
}
function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const a = cleaned.indexOf("{"); const b = cleaned.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("no json");
  return JSON.parse(cleaned.slice(a, b + 1));
}

function fallbackPlan(profile, targets) {
  const push = { focus: "Push strength", work: [{ n: "Incline push-up / bench", d: "4 x 8-10" }, { n: "Shoulder press", d: "3 x 10" }, { n: "Triceps dips", d: "3 x 12" }] };
  const pull = { focus: "Pull strength", work: [{ n: "Rows", d: "4 x 8-10" }, { n: "Lat pulldown / band pull", d: "3 x 10" }, { n: "Biceps curl", d: "3 x 12" }] };
  const legs = { focus: "Legs + core", work: [{ n: "Goblet squat", d: "4 x 10" }, { n: "Romanian deadlift", d: "3 x 10" }, { n: "Plank", d: "3 x 45s" }] };
  const cond = { focus: "Conditioning", work: [{ n: "Brisk walk / jog", d: "30-40 min Z2" }, { n: "Mobility flow", d: "10 min" }] };
  const rest = { focus: "Recovery", work: [{ n: "Easy walk", d: "20 min" }, { n: "Stretching", d: "10 min" }] };
  const seq = profile.days >= 5 ? [push, pull, legs, cond, push, rest, rest]
    : profile.days === 4 ? [push, pull, rest, legs, cond, rest, rest]
      : [push, rest, pull, rest, legs, rest, rest];
  return {
    summary: `A ${profile.days}-day ${GOALS.find(g => g.id === profile.goal).label.toLowerCase()} split built around ${targets.kcal} kcal and ${targets.protein} g protein per day.`,
    week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({ day, ...seq[i] })),
    tips: [
      `Anchor each meal around protein — aim for roughly ${Math.round(targets.protein / 4)} g per meal.`,
      "Log food before you eat it, not after. Decisions beat memories.",
      "Two poor days never ruin a week. Just make the next log a good one.",
    ],
    source: "template",
  };
}

async function aiPlan(profile, targets) {
  const prompt = `You are a certified fitness coach. Create a 1-week plan.
Client: ${profile.age}yo ${profile.sex}, ${profile.height}cm, ${profile.weight}kg. Goal: ${profile.goal}. Trains ${profile.days} days/week. Activity: ${profile.activity}.
Daily targets: ${targets.kcal} kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat.
Reply with ONLY minified JSON, no markdown, exactly this shape:
{"summary":"<=28 words","week":[{"day":"Mon","focus":"short title","work":[{"n":"exercise","d":"sets x reps or duration"}]}],"tips":["tip1","tip2","tip3"]}
Rules: week has exactly 7 entries Mon-Sun; ${profile.days} training days, the rest are focus "Recovery" with 1-2 light items; 3-4 work items on training days; keep every string short.`;
  const text = await askClaude([{ role: "user", content: prompt }]);
  const j = extractJSON(text);
  if (!j.week || j.week.length !== 7) throw new Error("bad shape");
  return { ...j, source: "ai" };
}

async function aiFood(desc, meal) {
  const prompt = `Estimate nutrition for this ${meal} entry: "${desc}" (Singapore context if ambiguous).
Reply with ONLY minified JSON, no markdown: {"name":"short cleaned dish name","kcal":int,"protein":int,"carbs":int,"fat":int}`;
  const text = await askClaude([{ role: "user", content: prompt }]);
  const j = extractJSON(text);
  return { name: String(j.name || desc).slice(0, 48), kcal: Math.round(+j.kcal || 0), p: Math.round(+j.protein || 0), c: Math.round(+j.carbs || 0), f: Math.round(+j.fat || 0), est: false };
}

/* ---------------- demo seed ---------------- */
function seedDemo() {
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

/* ================================================================ UI atoms */
const Eyebrow = ({ zone, children }) => (
  <div className="pc-mono flex items-center gap-2 text-xs font-medium tracking-widest" style={{ color: C.smoke }}>
    {zone && <span className="inline-block w-2 h-2 rounded-sm" style={{ background: C[zone] }} />}
    {zone && <span style={{ color: C[zone] }}>{ZONE_TAG[zone]}</span>}
    {zone && <span style={{ color: C.line }}>—</span>}
    <span>{children}</span>
  </div>
);

const ZoneMark = ({ h = 18 }) => (
  <svg width={h * 1.3} height={h} viewBox="0 0 26 20" aria-hidden="true">
    {[C.z1, C.z2, C.z3, C.z4, C.z5].map((c, i) => (
      <rect key={i} x={i * 5.2} y={20 - (8 + i * 3)} width="3.6" height={8 + i * 3} rx="1" fill={c} />
    ))}
  </svg>
);

const Card = ({ children, className = "", style = {} }) => (
  <section className={"rounded-2xl border p-4 " + className} style={{ background: C.card, borderColor: C.line, ...style }}>
    {children}
  </section>
);

const Ring = ({ pct, color, size = 116, label, sub }) => {
  const r = (size - 14) / 2, circ = 2 * Math.PI * r;
  const clamped = Math.min(pct, 1);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped)}
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="pc-display font-bold leading-none" style={{ fontSize: size * 0.26 }}>{label}</div>
        <div className="pc-mono text-xs mt-1" style={{ color: C.smoke }}>{sub}</div>
      </div>
    </div>
  );
};

const MacroBar = ({ name, val, max, zone }) => {
  const pct = Math.min(100, Math.round((val / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="pc-mono text-xs tracking-wider" style={{ color: C.smoke }}>{name}</span>
        <span className="pc-display text-base font-semibold">{val}<span className="text-xs font-medium" style={{ color: C.faint }}> / {max} g</span></span>
      </div>
      <div className="h-2 rounded-full mt-1" style={{ background: C.chalk }}>
        <div className="h-2 rounded-full" style={{ width: pct + "%", background: C[zone], transition: "width .5s ease" }} />
      </div>
    </div>
  );
};

const Btn = ({ children, onClick, kind = "solid", zone = null, disabled, className = "", small, ...rest }) => {
  const base = small ? "px-3 py-2 text-sm" : "px-4 py-3";
  const styles = kind === "solid"
    ? { background: zone ? C[zone] : C.iron, color: "#fff" }
    : kind === "ghost"
      ? { background: "transparent", color: C.ink, border: `1px solid ${C.line}` }
      : { background: C.chalk, color: C.ink };
  return (
    <button {...rest} onClick={onClick} disabled={disabled}
      className={`${base} rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 ${className}`}
      style={styles}>
      {children}
    </button>
  );
};

const Scale5 = ({ value, onChange, zone = "z1", labels = ["1", "2", "3", "4", "5"] }) => (
  <div className="flex gap-1.5">
    {labels.map((l, i) => {
      const v = i + 1, active = value === v;
      return (
        <button key={i} onClick={() => onChange(v)} aria-label={"score " + v}
          className="flex-1 py-2 rounded-lg pc-display text-lg font-semibold border"
          style={{ background: active ? C[zone] : C.card, color: active ? "#fff" : C.smoke, borderColor: active ? C[zone] : C.line }}>
          {l}
        </button>
      );
    })}
  </div>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="pc-mono text-xs tracking-wider" style={{ color: C.smoke }}>{label}</span>
    <div className="mt-1.5">{children}</div>
  </label>
);
const inputStyle = { background: C.card, border: `1px solid ${C.line}`, color: C.ink };
const Input = (props) => (
  <input {...props} className={"w-full rounded-xl px-3.5 py-3 text-base " + (props.className || "")} style={inputStyle} />
);

/* ================================================================ Onboarding */
function Onboarding({ onDone, onDemo }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ name: "", age: "", sex: "male", height: "", weight: "", activity: "light", goal: "lose", days: 4 });
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));
  const num = (v) => (v === "" ? "" : String(v).replace(/[^\d.]/g, ""));

  const canNext = step === 0 ? true
    : step === 1 ? p.name.trim() && +p.age >= 14 && +p.age <= 90
      : step === 2 ? +p.height >= 120 && +p.height <= 230 && +p.weight >= 35 && +p.weight <= 250
        : true;

  const finish = () => {
    const profile = { ...p, age: +p.age, height: +p.height, weight: +p.weight, name: p.name.trim() };
    onDone(profile);
  };

  const Choice = ({ items, value, onPick, zone }) => (
    <div className="grid grid-cols-1 gap-2">
      {items.map(it => {
        const active = value === it.id;
        return (
          <button key={it.id} onClick={() => onPick(it.id)}
            className="flex items-center justify-between rounded-xl px-4 py-3 border text-left"
            style={{ background: active ? C.card : C.card, borderColor: active ? C[zone] : C.line, boxShadow: active ? `inset 0 0 0 1px ${C[zone]}` : "none" }}>
            <span className="font-semibold">{it.label}</span>
            {active && <Check size={18} style={{ color: C[zone] }} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="pc-root min-h-screen flex flex-col" style={{ background: C.iron }}>
      <style>{GLOBAL_CSS}</style>
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-5 pt-10 pb-8">
        <div className="flex items-center gap-3">
          <ZoneMark h={22} />
          <span className="pc-display text-2xl font-bold tracking-wide" style={{ color: "#fff" }}>PULSECOACH</span>
        </div>

        {step === 0 && (
          <div className="pc-fade flex-1 flex flex-col justify-center">
            <div className="pc-mono text-xs tracking-widest mb-3" style={{ color: C.z3 }}>AI FITNESS ADVISOR · MVP</div>
            <h1 className="pc-display font-bold leading-none" style={{ color: "#fff", fontSize: 52 }}>
              Your coach,<br />on every rep,<br />every meal.
            </h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "#B9C2BB" }}>
              Onboard in a minute. PulseCoach computes your calorie and macro targets,
              writes your weekly plan with AI, checks in three times a day, and keeps
              your trainer in the loop.
            </p>
            <div className="mt-8 grid gap-2.5">
              <Btn onClick={() => setStep(1)} zone="z4" className="w-full">Get started <ArrowRight size={18} /></Btn>
              <button onClick={onDemo} className="w-full py-3 rounded-xl font-semibold"
                style={{ color: "#DDE4DE", border: "1px solid #3B463E", background: "transparent" }}>
                Explore with demo data
              </button>
            </div>
          </div>
        )}

        {step > 0 && (
          <div className="pc-fade flex-1 flex flex-col rounded-2xl mt-6 p-5" style={{ background: C.chalk }}>
            <div className="pc-mono text-xs tracking-widest" style={{ color: C.smoke }}>STEP {step} / 3</div>
            {step === 1 && (
              <div className="mt-3 grid gap-4">
                <h2 className="pc-display text-3xl font-bold">About you</h2>
                <Field label="FIRST NAME"><Input value={p.name} onChange={e => set("name", e.target.value)} placeholder="Alex" /></Field>
                <Field label="AGE"><Input inputMode="numeric" value={p.age} onChange={e => set("age", num(e.target.value))} placeholder="32" /></Field>
                <Field label="SEX (FOR THE BMR FORMULA)">
                  <div className="grid grid-cols-2 gap-2">
                    {["male", "female"].map(s => (
                      <button key={s} onClick={() => set("sex", s)} className="py-3 rounded-xl font-semibold capitalize border"
                        style={{ background: p.sex === s ? C.iron : C.card, color: p.sex === s ? "#fff" : C.ink, borderColor: p.sex === s ? C.iron : C.line }}>{s}</button>
                    ))}
                  </div>
                </Field>
              </div>
            )}
            {step === 2 && (
              <div className="mt-3 grid gap-4">
                <h2 className="pc-display text-3xl font-bold">Body + activity</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="HEIGHT (CM)"><Input inputMode="decimal" value={p.height} onChange={e => set("height", num(e.target.value))} placeholder="173" /></Field>
                  <Field label="WEIGHT (KG)"><Input inputMode="decimal" value={p.weight} onChange={e => set("weight", num(e.target.value))} placeholder="78" /></Field>
                </div>
                <Field label="TYPICAL DAY"><Choice items={ACTIVITY} value={p.activity} onPick={v => set("activity", v)} zone="z1" /></Field>
              </div>
            )}
            {step === 3 && (
              <div className="mt-3 grid gap-4">
                <h2 className="pc-display text-3xl font-bold">Your goal</h2>
                <Choice items={GOALS} value={p.goal} onPick={v => set("goal", v)} zone="z4" />
                <Field label="TRAINING DAYS / WEEK">
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 4, 5].map(d => (
                      <button key={d} onClick={() => set("days", d)} className="py-3 rounded-xl pc-display text-xl font-bold border"
                        style={{ background: p.days === d ? C.z4 : C.card, color: p.days === d ? "#fff" : C.ink, borderColor: p.days === d ? C.z4 : C.line }}>{d}</button>
                    ))}
                  </div>
                </Field>
                {+p.weight > 0 && +p.height > 0 && +p.age > 0 && (
                  <div className="rounded-xl p-3.5" style={{ background: C.card, border: `1px dashed ${C.line}` }}>
                    <Eyebrow zone="z3">LIVE PREVIEW</Eyebrow>
                    <PreviewTargets p={p} />
                  </div>
                )}
              </div>
            )}
            <div className="mt-auto pt-6 flex gap-2">
              {step > 1 && <Btn kind="ghost" onClick={() => setStep(step - 1)}>Back</Btn>}
              {step < 3
                ? <Btn onClick={() => setStep(step + 1)} disabled={!canNext} className="flex-1">Continue <ChevronRight size={18} /></Btn>
                : <Btn zone="z4" onClick={finish} disabled={!canNext} className="flex-1">Create my profile <Sparkles size={18} /></Btn>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PreviewTargets = ({ p }) => {
  const t = computeTargets({ ...p, age: +p.age || 30, height: +p.height || 170, weight: +p.weight || 70 });
  return (
    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
      {[["BMR", t.bmr], ["TDEE", t.tdee], ["TARGET", t.kcal]].map(([k, v]) => (
        <div key={k}>
          <div className="pc-display text-2xl font-bold">{v.toLocaleString()}</div>
          <div className="pc-mono text-xs" style={{ color: C.smoke }}>{k} KCAL</div>
        </div>
      ))}
    </div>
  );
};

/* ================================================================ Today */
function TodayScreen({ state, mutate, gotoTab }) {
  const today = dayISO();
  const day = state.journal[today] || { foods: [], workouts: [], checkins: {} };
  const eaten = day.foods.reduce((s, f) => s + f.kcal, 0);
  const P = day.foods.reduce((s, f) => s + f.p, 0);
  const Cb = day.foods.reduce((s, f) => s + f.c, 0);
  const F = day.foods.reduce((s, f) => s + f.f, 0);
  const t = state.targets;
  const ratio = eaten / t.kcal;
  const fuelZone = ratio <= 1 ? "z2" : ratio <= 1.1 ? "z3" : "z5";
  const remaining = t.kcal - eaten;

  const weights = Object.entries(state.journal)
    .filter(([, d]) => d.weight)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([iso, d]) => ({ d: iso.slice(5), w: d.weight }));
  const delta = weights.length >= 2 ? +(weights[weights.length - 1].w - weights[0].w).toFixed(1) : 0;

  const streak = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const d = state.journal[shiftISO(-i)];
      const active = d && (d.foods.length || d.workouts.length || Object.keys(d.checkins || {}).length);
      if (active) n++; else if (i === 0) continue; else break;
    }
    return n;
  }, [state.journal]);

  const todaysSession = useMemo(() => {
    if (!state.plan) return null;
    const dowMap = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun" };
    return state.plan.week.find(w => w.day === dowMap[new Date().getDay()]);
  }, [state.plan]);

  return (
    <div className="grid gap-3 pc-fade">
      <div className="flex items-end justify-between px-1">
        <div>
          <Eyebrow zone="z3">TODAY · {fmtHeader()}</Eyebrow>
          <h2 className="pc-display text-3xl font-bold mt-1">Hello, {state.profile.name.split(" ")[0]}</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <Flame size={15} style={{ color: C.z4 }} />
          <span className="pc-display font-bold">{streak}</span>
          <span className="pc-mono text-xs" style={{ color: C.smoke }}>DAY</span>
        </div>
      </div>

      {!state.plan && (
        <button onClick={() => gotoTab("plan")} className="rounded-2xl p-4 flex items-center justify-between text-left"
          style={{ background: C.iron, color: "#fff" }}>
          <div>
            <div className="pc-mono text-xs tracking-widest" style={{ color: C.z3 }}>NEXT STEP</div>
            <div className="pc-display text-xl font-bold mt-0.5">Generate your AI training plan</div>
          </div>
          <ChevronRight />
        </button>
      )}

      <Card>
        <Eyebrow zone="z3">FUEL</Eyebrow>
        <div className="flex items-center gap-4 mt-3">
          <Ring pct={ratio} color={C[fuelZone]}
            label={Math.abs(remaining).toLocaleString()}
            sub={remaining >= 0 ? "KCAL LEFT" : "KCAL OVER"} />
          <div className="flex-1 grid gap-2.5">
            <MacroBar name="PROTEIN" val={P} max={t.protein} zone="z2" />
            <MacroBar name="CARBS" val={Cb} max={t.carbs} zone="z3" />
            <MacroBar name="FAT" val={F} max={t.fat} zone="z4" />
          </div>
        </div>
        <div className="pc-mono text-xs mt-3 pt-3 flex justify-between" style={{ color: C.smoke, borderTop: `1px solid ${C.line}` }}>
          <span>EATEN {eaten.toLocaleString()}</span><span>TARGET {t.kcal.toLocaleString()}</span><span>TDEE {t.tdee.toLocaleString()}</span>
        </div>
      </Card>

      <CheckinBlock state={state} mutate={mutate} />

      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow zone="z1">BODYWEIGHT</Eyebrow>
          {weights.length >= 2 && (
            <span className="pc-mono text-xs font-semibold" style={{ color: delta <= 0 ? C.z2 : C.z5 }}>
              {delta > 0 ? "+" : ""}{delta} KG / {weights.length}D
            </span>
          )}
        </div>
        {weights.length >= 2 ? (
          <div className="h-28 mt-2 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weights} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <defs>
                  <linearGradient id="pcW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.z1} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.z1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: C.faint, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={["dataMin - 0.4", "dataMax + 0.4"]} hide />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: "Barlow", fontSize: 13 }} formatter={(v) => [v + " kg", "Weight"]} labelStyle={{ color: C.smoke }} />
                <Area type="monotone" dataKey="w" stroke={C.z1} strokeWidth={2.5} fill="url(#pcW)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm mt-2" style={{ color: C.smoke }}>Log your weight in the morning check-in — the trend appears after two entries.</p>
        )}
      </Card>

      {todaysSession && (
        <Card>
          <div className="flex items-center justify-between">
            <Eyebrow zone="z4">TODAY'S SESSION</Eyebrow>
            <button onClick={() => gotoTab("plan")} className="pc-mono text-xs font-semibold" style={{ color: C.z4 }}>FULL PLAN →</button>
          </div>
          <div className="pc-display text-2xl font-bold mt-1.5">{todaysSession.focus}</div>
          <div className="mt-2 grid gap-1.5">
            {todaysSession.work.map((w, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5 px-3 rounded-lg" style={{ background: C.chalk }}>
                <span className="font-medium">{w.n}</span>
                <span className="pc-mono text-xs self-center" style={{ color: C.smoke }}>{w.d}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Check-ins (mirrors 08:00 / 14:00 / 22:00 loop) ---------------- */
function CheckinBlock({ state, mutate }) {
  const today = dayISO();
  const done = (state.journal[today] && state.journal[today].checkins) || {};
  const hour = new Date().getHours();
  const [open, setOpen] = useState(null);

  const slots = [
    { id: "morning", label: "Morning", time: "08:00", icon: Sun, unlocked: true },
    { id: "midday", label: "Midday", time: "14:00", icon: Zap, unlocked: hour >= 11 },
    { id: "evening", label: "Evening", time: "22:00", icon: Moon, unlocked: hour >= 17 },
  ];

  return (
    <Card>
      <Eyebrow zone="z2">DAILY CHECK-INS</Eyebrow>
      <div className="mt-3 grid gap-2">
        {slots.map((s) => {
          const isDone = !!done[s.id];
          const Icon = s.icon;
          return (
            <div key={s.id}>
              <button onClick={() => s.unlocked && !isDone && setOpen(open === s.id ? null : s.id)}
                className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 border text-left"
                style={{
                  background: isDone ? C.chalk : C.card,
                  borderColor: open === s.id ? C.z2 : C.line,
                  opacity: s.unlocked || isDone ? 1 : 0.55,
                }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: isDone ? C.z2 : C.chalk, color: isDone ? "#fff" : C.smoke }}>
                  {isDone ? <Check size={16} /> : <Icon size={15} />}
                </span>
                <span className="flex-1">
                  <span className="font-semibold">{s.label}</span>
                  <span className="pc-mono text-xs ml-2" style={{ color: C.faint }}>{s.time}</span>
                </span>
                {isDone
                  ? <span className="pc-mono text-xs" style={{ color: C.z2 }}>LOGGED {done[s.id].at}</span>
                  : s.unlocked
                    ? <span className="pc-mono text-xs font-semibold" style={{ color: C.z4 }}>LOG NOW</span>
                    : <Lock size={14} style={{ color: C.faint }} />}
              </button>
              {open === s.id && !isDone && (
                <CheckinForm slot={s.id} state={state} mutate={mutate} onDone={() => setOpen(null)} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CheckinForm({ slot, state, mutate, onDone }) {
  const [v, setV] = useState({ weight: "", sleep: 0, energy: 0, mood: 0, water: 0, rating: 0, onPlan: null, note: "" });
  const set = (k, x) => setV(p => ({ ...p, [k]: x }));
  const at = new Date().toTimeString().slice(0, 5);

  const valid = slot === "morning" ? v.sleep && v.energy
    : slot === "midday" ? v.mood
      : v.rating && v.onPlan !== null;

  const submit = () => {
    mutate(s => {
      const today = dayISO();
      const day = s.journal[today] || { foods: [], workouts: [], checkins: {} };
      const entry = slot === "morning"
        ? { weight: v.weight ? +v.weight : undefined, sleep: v.sleep, energy: v.energy, at }
        : slot === "midday"
          ? { mood: v.mood, water: +v.water || 0, at }
          : { rating: v.rating, onPlan: v.onPlan, note: v.note.trim(), at };
      const journal = { ...s.journal, [today]: { ...day, weight: slot === "morning" && v.weight ? +v.weight : day.weight, checkins: { ...day.checkins, [slot]: entry } } };
      return { ...s, journal };
    });
    onDone();
  };

  return (
    <div className="pc-fade rounded-xl p-4 mt-1.5 grid gap-3.5" style={{ background: C.chalk, border: `1px solid ${C.line}` }}>
      {slot === "morning" && (<>
        <Field label="TODAY'S WEIGHT (KG) — OPTIONAL">
          <Input inputMode="decimal" value={v.weight} onChange={e => set("weight", e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(state.profile.weight)} />
        </Field>
        <Field label="SLEEP QUALITY"><Scale5 value={v.sleep} onChange={x => set("sleep", x)} zone="z1" /></Field>
        <Field label="ENERGY"><Scale5 value={v.energy} onChange={x => set("energy", x)} zone="z3" /></Field>
      </>)}
      {slot === "midday" && (<>
        <Field label="MOOD"><Scale5 value={v.mood} onChange={x => set("mood", x)} zone="z2" /></Field>
        <Field label="WATER SO FAR (GLASSES)">
          <div className="flex items-center gap-3">
            <Droplets size={18} style={{ color: C.z1 }} />
            <Input inputMode="numeric" value={v.water || ""} onChange={e => set("water", e.target.value.replace(/\D/g, ""))} placeholder="4" />
          </div>
        </Field>
      </>)}
      {slot === "evening" && (<>
        <Field label="HOW WAS TODAY?"><Scale5 value={v.rating} onChange={x => set("rating", x)} zone="z3" /></Field>
        <Field label="STAYED ON PLAN?">
          <div className="grid grid-cols-2 gap-2">
            {[["Yes", true], ["Mostly not", false]].map(([l, val]) => (
              <button key={l} onClick={() => set("onPlan", val)} className="py-2.5 rounded-lg font-semibold border"
                style={{ background: v.onPlan === val ? (val ? C.z2 : C.z5) : C.card, color: v.onPlan === val ? "#fff" : C.ink, borderColor: v.onPlan === val ? "transparent" : C.line }}>{l}</button>
            ))}
          </div>
        </Field>
        <Field label="NOTE FOR YOUR COACH — OPTIONAL">
          <Input value={v.note} onChange={e => set("note", e.target.value)} placeholder="Skipped lunch, big dinner…" />
        </Field>
      </>)}
      <Btn zone="z2" onClick={submit} disabled={!valid} small>Save check-in <Check size={16} /></Btn>
    </div>
  );
}

/* ================================================================ Log */
function LogScreen({ state, mutate, notify }) {
  const today = dayISO();
  const day = state.journal[today] || { foods: [], workouts: [], checkins: {} };
  const [food, setFood] = useState("");
  const [meal, setMeal] = useState("lunch");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [keyPanel, setKeyPanel] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [wo, setWo] = useState({ name: "", mins: "" });
  const fileRef = useRef(null);

  const write = (fn) => mutate(s => {
    const d = s.journal[today] || { foods: [], workouts: [], checkins: {} };
    return { ...s, journal: { ...s.journal, [today]: fn(d) } };
  });

  const addFood = async () => {
    const desc = food.trim();
    if (!desc || busy) return;
    setBusy(true);
    let item;
    try {
      item = await aiFood(desc, meal);
    } catch (e) {
      item = { name: desc.slice(0, 48), kcal: 300, p: 12, c: 35, f: 10, est: true };
      notify("Coach AI unreachable — added a rough 300 kcal estimate you can delete.");
    }
    write(d => ({ ...d, foods: [...d.foods, { id: String(Date.now()), meal, ...item }] }));
    setFood(""); setBusy(false);
  };

  const openCamera = () => {
    if (photoBusy) return;
    if (!getApiKey()) { setKeyPanel(true); return; }
    fileRef.current?.click();
  };

  const addPhoto = async (file) => {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      const item = await aiFoodPhoto(dataUrl, meal);
      write(d => ({ ...d, foods: [...d.foods, { id: String(Date.now()), meal, ...item }] }));
      notify(`Logged "${item.name}" — ${item.kcal} kcal.`);
    } catch (e) {
      notify(e.message === "not_food"
        ? "Couldn't spot any food in that photo — try a clearer shot."
        : "Photo analysis failed — check your AI key in the key panel, then try again.");
    }
    setPhotoBusy(false);
  };

  const saveKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    setApiKey(k);
    setKeyDraft(""); setKeyPanel(false);
    notify("Key saved on this device — tap the camera to analyse a food photo.");
  };

  const addWorkout = () => {
    if (!wo.name.trim()) return;
    write(d => ({ ...d, workouts: [...d.workouts, { id: String(Date.now()), name: wo.name.trim(), mins: +wo.mins || 0 }] }));
    setWo({ name: "", mins: "" });
  };

  const meals = ["breakfast", "lunch", "dinner", "snack"];
  const grouped = meals.map(m => [m, day.foods.filter(f => f.meal === m)]);

  return (
    <div className="grid gap-3 pc-fade">
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow zone="z3">FUEL LOG · AI-PARSED</Eyebrow>
          <button aria-label="AI key settings" onClick={() => setKeyPanel(p => !p)}
            className="p-1.5 rounded-lg" style={{ color: getApiKey() ? C.z2 : C.faint }}>
            <KeyRound size={15} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3">
          {meals.map(m => (
            <button key={m} onClick={() => setMeal(m)} className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize border"
              style={{ background: meal === m ? C.z3 : C.card, color: meal === m ? "#fff" : C.smoke, borderColor: meal === m ? C.z3 : C.line }}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input value={food} onChange={e => setFood(e.target.value)} placeholder="e.g. chicken rice, less rice"
            onKeyDown={e => e.key === "Enter" && addFood()} />
          <Btn zone="z3" onClick={openCamera} disabled={photoBusy} small className="shrink-0" aria-label="log food from photo">
            {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          </Btn>
          <Btn zone="z3" onClick={addFood} disabled={busy || !food.trim()} small className="shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Add
          </Btn>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        {busy && <div className="pc-mono text-xs mt-2 pc-pulse" style={{ color: C.z3 }}>COACH IS ESTIMATING MACROS…</div>}
        {photoBusy && <div className="pc-mono text-xs mt-2 pc-pulse" style={{ color: C.z3 }}>COACH IS READING YOUR PHOTO…</div>}
        {keyPanel && (
          <div className="mt-3 rounded-xl p-3" style={{ background: C.chalk, border: `1px solid ${C.line}` }}>
            <div className="pc-mono flex items-center gap-1.5 text-xs tracking-wider" style={{ color: C.smoke }}>
              <KeyRound size={12} /> ANTHROPIC API KEY
            </div>
            <p className="text-xs mt-1.5" style={{ color: C.smoke }}>
              Photo recognition calls Claude directly from your browser. Paste an API key from console.anthropic.com —
              it is stored only on this device, never uploaded anywhere else.
            </p>
            <div className="flex gap-2 mt-2">
              <Input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="sk-ant-..."
                onKeyDown={e => e.key === "Enter" && saveKey()} />
              <Btn zone="z3" onClick={saveKey} disabled={!keyDraft.trim()} small className="shrink-0">Save</Btn>
            </div>
            <div className="flex gap-3 mt-2">
              {getApiKey() && (
                <button onClick={() => { setApiKey(""); notify("Key removed from this device."); }}
                  className="text-xs underline" style={{ color: C.z5 }}>Remove saved key</button>
              )}
              <button onClick={() => setKeyPanel(false)} className="text-xs underline" style={{ color: C.smoke }}>Close</button>
            </div>
          </div>
        )}
        <div className="mt-3 grid gap-3">
          {grouped.map(([m, items]) => items.length > 0 && (
            <div key={m}>
              <div className="pc-mono text-xs tracking-wider capitalize" style={{ color: C.faint }}>{m.toUpperCase()}</div>
              {items.map(f => (
                <div key={f.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${C.chalk}` }}>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{f.name}{f.est && <span className="pc-mono text-xs ml-1" style={{ color: C.z5 }}>~EST</span>}</div>
                    <div className="pc-mono text-xs" style={{ color: C.smoke }}>P{f.p} C{f.c} F{f.f}</div>
                  </div>
                  <div className="pc-display text-lg font-bold">{f.kcal}<span className="text-xs font-medium" style={{ color: C.faint }}> kcal</span></div>
                  <button aria-label="delete food" onClick={() => write(d => ({ ...d, foods: d.foods.filter(x => x.id !== f.id) }))}
                    className="p-1.5 rounded-lg" style={{ color: C.faint }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          ))}
          {day.foods.length === 0 && <p className="text-sm" style={{ color: C.smoke }}>Nothing logged yet. Type a meal above — the AI estimates calories and macros for you.</p>}
        </div>
      </Card>

      <Card>
        <Eyebrow zone="z4">TRAINING LOG</Eyebrow>
        <div className="flex gap-2 mt-3">
          <Input value={wo.name} onChange={e => setWo(p => ({ ...p, name: e.target.value }))} placeholder="Session — e.g. Push day" />
          <Input value={wo.mins} onChange={e => setWo(p => ({ ...p, mins: e.target.value.replace(/\D/g, "") }))} placeholder="min" className="w-20 shrink-0" inputMode="numeric" />
          <Btn zone="z4" onClick={addWorkout} disabled={!wo.name.trim()} small className="shrink-0"><Plus size={16} /></Btn>
        </div>
        <div className="mt-3 grid gap-1.5">
          {day.workouts.map(w => (
            <div key={w.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.chalk }}>
              <Dumbbell size={15} style={{ color: C.z4 }} />
              <span className="flex-1 text-sm font-medium">{w.name}</span>
              {w.mins > 0 && <span className="pc-mono text-xs" style={{ color: C.smoke }}>{w.mins} MIN</span>}
              <button aria-label="delete workout" onClick={() => write(d => ({ ...d, workouts: d.workouts.filter(x => x.id !== w.id) }))}
                className="p-1" style={{ color: C.faint }}><Trash2 size={14} /></button>
            </div>
          ))}
          {day.workouts.length === 0 && <p className="text-sm" style={{ color: C.smoke }}>No sessions logged today.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================ Plan */
function PlanScreen({ state, mutate, notify }) {
  const [busy, setBusy] = useState(false);
  const dowMap = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun" };
  const todayName = dowMap[new Date().getDay()];

  const generate = async () => {
    setBusy(true);
    let plan;
    try {
      plan = await aiPlan(state.profile, state.targets);
    } catch (e) {
      plan = fallbackPlan(state.profile, state.targets);
      notify("Coach AI unreachable — loaded the built-in template plan instead.");
    }
    mutate(s => ({ ...s, plan }));
    setBusy(false);
  };

  const markDone = (w) => {
    mutate(s => {
      const today = dayISO();
      const d = s.journal[today] || { foods: [], workouts: [], checkins: {} };
      return { ...s, journal: { ...s.journal, [today]: { ...d, workouts: [...d.workouts, { id: String(Date.now()), name: w.focus + " (plan)", mins: 45 }] } } };
    });
    notify("Session logged — nice work.");
  };

  if (!state.plan) {
    return (
      <div className="pc-fade">
        <Card className="text-center py-10">
          <div className="flex justify-center"><ZoneMark h={26} /></div>
          <h2 className="pc-display text-3xl font-bold mt-4">Your week, written by AI</h2>
          <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: C.smoke }}>
            One tap. PulseCoach turns your profile — {state.profile.days} days a week,
            {" "}{state.targets.kcal.toLocaleString()} kcal target — into a 7-day plan.
          </p>
          <div className="mt-5 flex justify-center">
            <Btn zone="z4" onClick={generate} disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {busy ? "Coach is writing…" : "Generate my plan"}
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-3 pc-fade">
      <Card style={{ background: C.iron, borderColor: C.iron }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="pc-mono text-xs tracking-widest" style={{ color: C.z3 }}>
              WEEKLY PLAN · {state.plan.source === "ai" ? "AI-GENERATED" : "TEMPLATE"}
            </div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#D7DED8" }}>{state.plan.summary}</p>
          </div>
          <button aria-label="regenerate plan" onClick={generate} disabled={busy}
            className="p-2.5 rounded-xl shrink-0" style={{ background: C.iron2, color: "#fff" }}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
          </button>
        </div>
      </Card>

      {state.plan.week.map((w) => {
        const isToday = w.day === todayName;
        const isRest = /recover/i.test(w.focus);
        return (
          <Card key={w.day} style={isToday ? { boxShadow: `inset 0 0 0 2px ${C.z4}` } : {}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="pc-display text-lg font-bold w-11 text-center py-0.5 rounded-lg"
                  style={{ background: isToday ? C.z4 : C.chalk, color: isToday ? "#fff" : C.smoke }}>{w.day}</span>
                <span className="font-semibold">{w.focus}</span>
              </div>
              <span className="pc-mono text-xs" style={{ color: isRest ? C.z1 : C.z4 }}>
                {isRest ? "Z1" : "Z4"}
              </span>
            </div>
            <div className="mt-2.5 grid gap-1">
              {w.work.map((x, i) => (
                <div key={i} className="flex justify-between text-sm py-1" style={{ borderBottom: i < w.work.length - 1 ? `1px solid ${C.chalk}` : "none" }}>
                  <span>{x.n}</span>
                  <span className="pc-mono text-xs self-center" style={{ color: C.smoke }}>{x.d}</span>
                </div>
              ))}
            </div>
            {isToday && !isRest && (
              <div className="mt-3">
                <Btn zone="z4" small onClick={() => markDone(w)}>Mark session done <Check size={15} /></Btn>
              </div>
            )}
          </Card>
        );
      })}

      <Card>
        <Eyebrow zone="z2">COACH'S NOTES</Eyebrow>
        <div className="mt-2 grid gap-2">
          {state.plan.tips.map((t, i) => (
            <div key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="pc-display font-bold" style={{ color: C.z2 }}>{String(i + 1).padStart(2, "0")}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================ Coach chat */
function CoachScreen({ state, mutate }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }); }, [state.chat, busy]);

  const context = () => {
    const today = dayISO();
    const d = state.journal[today] || { foods: [], workouts: [], checkins: {} };
    const eaten = d.foods.reduce((s, f) => s + f.kcal, 0);
    const prot = d.foods.reduce((s, f) => s + f.p, 0);
    return `You are PulseCoach, a friendly, direct fitness coach inside a mobile app.
Client: ${state.profile.name}, ${state.profile.age}yo ${state.profile.sex}, ${state.profile.height}cm, ${state.profile.weight}kg. Goal: ${state.profile.goal} (${state.profile.days} training days/week).
Daily targets: ${state.targets.kcal} kcal, ${state.targets.protein}g protein. Today so far: ${eaten} kcal, ${prot}g protein, ${d.workouts.length} workout(s) logged. Weekly focus today: ${state.plan ? (state.plan.week.find(w => w.day === ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()]) || {}).focus || "n/a" : "no plan yet"}.
Rules: be specific to this client's numbers; keep replies under 110 words; plain text only, no markdown headers; encouraging but honest; you are not a doctor — for pain, injury or medical issues, advise seeing a professional.`;
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput("");
    mutate(s => ({ ...s, chat: [...s.chat, { role: "user", content: q }] }));
    setBusy(true);
    try {
      const history = [...state.chat, { role: "user", content: q }].slice(-10);
      const messages = [
        { role: "user", content: context() },
        { role: "assistant", content: "Got it — I have this client's profile and today's numbers. Ready to coach." },
        ...history,
      ];
      const reply = await askClaude(messages);
      mutate(s => ({ ...s, chat: [...s.chat, { role: "assistant", content: reply || "…" }] }));
    } catch (e) {
      mutate(s => ({ ...s, chat: [...s.chat, { role: "assistant", content: "I couldn't reach the coaching engine just now. Try again in a moment — your logs are all saved." }] }));
    }
    setBusy(false);
  };

  const chips = ["What should I eat for dinner?", "I missed today's workout", "Why is my weight up today?"];

  return (
    <div className="pc-fade flex flex-col" style={{ height: "calc(100vh - 190px)", minHeight: 380 }}>
      <div className="pc-chat flex-1 overflow-y-auto grid gap-2.5 content-start pr-1">
        {state.chat.length === 0 && (
          <Card className="text-center py-8">
            <MessageCircle className="mx-auto" style={{ color: C.z1 }} />
            <h3 className="pc-display text-2xl font-bold mt-2">Ask your coach anything</h3>
            <p className="text-sm mt-1" style={{ color: C.smoke }}>It already knows your goal, targets and today's logs.</p>
          </Card>
        )}
        {state.chat.map((m, i) => (
          <div key={i} className={"max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " + (m.role === "user" ? "justify-self-end" : "justify-self-start")}
            style={m.role === "user"
              ? { background: C.iron, color: "#fff", borderBottomRightRadius: 6 }
              : { background: C.card, border: `1px solid ${C.line}`, borderBottomLeftRadius: 6 }}>
            {m.role === "assistant" && <div className="pc-mono text-xs mb-1" style={{ color: C.z1 }}>COACH</div>}
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="justify-self-start rounded-2xl px-3.5 py-2.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <span className="pc-mono text-xs pc-pulse" style={{ color: C.z1 }}>COACH IS TYPING…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {state.chat.length === 0 && (
        <div className="flex flex-wrap gap-1.5 py-2">
          {chips.map(c => (
            <button key={c} onClick={() => send(c)} className="px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{ background: C.card, borderColor: C.line, color: C.smoke }}>{c}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Message your coach…"
          onKeyDown={e => e.key === "Enter" && send()} />
        <Btn zone="z1" onClick={() => send()} disabled={busy || !input.trim()} small className="shrink-0" aria-label="send">
          <Send size={16} />
        </Btn>
      </div>
    </div>
  );
}

/* ================================================================ Trainer HQ */
const DEMO_CLIENTS = [
  { name: "Priya M.", goal: "CUT", compliance: 92, delta: -1.4, alerts: [] },
  { name: "Marcus L.", goal: "BUILD", compliance: 64, delta: 0.6, alerts: ["2 missed evening check-ins"] },
  { name: "Wen Jie", goal: "HOLD", compliance: 78, delta: -0.2, alerts: ["No workout logged in 4 days"] },
];

function TrainerScreen({ state, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const last7 = [...Array(7)].map((_, i) => shiftISO(-i));
  const daysWithData = last7.filter(iso => {
    const d = state.journal[iso];
    return d && (Object.keys(d.checkins || {}).length >= 2 || d.foods.length >= 2);
  }).length;
  const compliance = Math.round((daysWithData / 7) * 100);

  const alerts = [];
  const yest = state.journal[shiftISO(-1)];
  if (!yest || !(yest.checkins && yest.checkins.evening)) alerts.push("No evening check-in yesterday");
  const today = state.journal[dayISO()];
  if (!today || today.foods.length === 0) alerts.push("No food logged yet today");

  const weights = Object.entries(state.journal).filter(([, d]) => d.weight).sort(([a], [b]) => a.localeCompare(b));
  const delta = weights.length >= 2 ? +(weights[weights.length - 1][1].weight - weights[0][1].weight).toFixed(1) : 0;

  const you = { name: state.profile.name + " (live)", goal: (GOALS.find(g => g.id === state.profile.goal) || {}).tag, compliance, delta, alerts, live: true };
  const clients = [you, ...DEMO_CLIENTS];

  return (
    <div className="grid gap-3 pc-fade">
      <div className="px-1">
        <Eyebrow zone="z5">TRAINER HQ</Eyebrow>
        <h2 className="pc-display text-3xl font-bold mt-1">Client board</h2>
        <p className="text-sm mt-1" style={{ color: C.smoke }}>
          Every check-in and log streams here in real time — intervene when needed, not always.
        </p>
      </div>

      {clients.map((c, i) => (
        <Card key={i} style={c.live ? { boxShadow: `inset 0 0 0 2px ${C.z2}` } : {}}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center pc-display text-lg font-bold"
              style={{ background: C.iron, color: "#fff" }}>{c.name[0]}</span>
            <div className="flex-1">
              <div className="font-semibold">{c.name}
                {c.live && <span className="pc-mono text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: C.z2, color: "#fff" }}>LIVE</span>}
              </div>
              <div className="pc-mono text-xs" style={{ color: C.smoke }}>{c.goal} · {c.delta > 0 ? "+" : ""}{c.delta} KG</div>
            </div>
            <div className="text-right">
              <div className="pc-display text-2xl font-bold" style={{ color: c.compliance >= 80 ? C.z2 : c.compliance >= 60 ? C.z3 : C.z5 }}>{c.compliance}%</div>
              <div className="pc-mono text-xs" style={{ color: C.faint }}>7D ADHERENCE</div>
            </div>
          </div>
          {c.alerts.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              {c.alerts.map((a, j) => (
                <div key={j} className="flex items-center gap-2 text-xs font-medium rounded-lg px-2.5 py-1.5"
                  style={{ background: "#FBEAE7", color: C.z5 }}>
                  <AlertTriangle size={13} /> {a}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Card>
        <Eyebrow zone="z5">DANGER ZONE</Eyebrow>
        <p className="text-sm mt-2" style={{ color: C.smoke }}>Wipes the profile, plan, logs and chat on this device.</p>
        <div className="mt-3">
          {!confirmReset
            ? <Btn kind="ghost" small onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset all data</Btn>
            : <Btn zone="z5" small onClick={onReset}>Tap again to confirm reset</Btn>}
        </div>
      </Card>

      <p className="pc-mono text-center text-xs pb-2" style={{ color: C.faint }}>
        MVP · demo clients are sample data · production: Supabase + n8n check-ins
      </p>
    </div>
  );
}

/* ================================================================ Shell */
const TABS = [
  { id: "today", label: "Today", icon: LayoutGrid, zone: "z3" },
  { id: "log", label: "Log", icon: Utensils, zone: "z2" },
  { id: "plan", label: "Plan", icon: Dumbbell, zone: "z4" },
  { id: "coach", label: "Coach", icon: MessageCircle, zone: "z1" },
  { id: "hq", label: "HQ", icon: User, zone: "z5" },
];

export default function PulseCoach() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => { loadState().then(s => { setState(s); setLoaded(true); }); }, []);

  useEffect(() => {
    if (!loaded || !state) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveState(state), 350);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded]);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };
  const mutate = (fn) => setState(prev => fn(prev));

  if (!loaded) {
    return (
      <div className="pc-root min-h-screen flex items-center justify-center" style={{ background: C.iron }}>
        <style>{GLOBAL_CSS}</style>
        <div className="pc-pulse"><ZoneMark h={28} /></div>
      </div>
    );
  }

  if (!state || !state.profile) {
    return (
      <Onboarding
        onDone={(profile) => {
          const targets = computeTargets(profile);
          setState({ profile, targets, plan: null, journal: {}, chat: [], created: Date.now() });
          setTab("today");
        }}
        onDemo={() => { setState(seedDemo()); setTab("today"); }}
      />
    );
  }

  return (
    <div className="pc-root min-h-screen flex flex-col" style={{ background: C.chalk }}>
      <style>{GLOBAL_CSS}</style>

      <header className="sticky top-0 z-20 px-4 py-3 flex items-center gap-2.5" style={{ background: C.iron }}>
        <ZoneMark h={18} />
        <span className="pc-display text-lg font-bold tracking-wide" style={{ color: "#fff" }}>PULSECOACH</span>
        <span className="pc-mono text-xs ml-auto" style={{ color: "#8FA095" }}>
          {state.targets.kcal.toLocaleString()} KCAL / DAY
        </span>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 pb-24">
        {tab === "today" && <TodayScreen state={state} mutate={mutate} gotoTab={setTab} />}
        {tab === "log" && <LogScreen state={state} mutate={mutate} notify={notify} />}
        {tab === "plan" && <PlanScreen state={state} mutate={mutate} notify={notify} />}
        {tab === "coach" && <CoachScreen state={state} mutate={mutate} />}
        {tab === "hq" && <TrainerScreen state={state} onReset={async () => { await clearState(); setState(null); setTab("today"); }} />}
      </main>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 pc-fade px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: C.iron, color: "#fff", maxWidth: "88%" }}>
          {toast}
        </div>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-20" style={{ background: C.iron }}>
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map(t => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="py-2.5 flex flex-col items-center gap-1" aria-label={t.label}>
                <Icon size={19} style={{ color: active ? C[t.zone] : "#77857B" }} />
                <span className="pc-mono text-xs" style={{ color: active ? "#fff" : "#77857B" }}>{t.label.toUpperCase()}</span>
                <span className="w-5 h-0.5 rounded-full" style={{ background: active ? C[t.zone] : "transparent" }} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
