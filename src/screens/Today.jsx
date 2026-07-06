import React, { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Check, ChevronRight, Droplets, Flame, Lock, Moon, Sun, Zap } from "lucide-react";
import { C } from "../theme.js";
import { Btn, Card, Eyebrow, Field, Input, MacroBar, Ring, Scale5 } from "../ui.jsx";
import { dayISO, fmtHeader, nowHM, shiftISO, todayName } from "../lib.js";

export default function Today({ state, mutate, gotoTab }) {
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

  const session = useMemo(
    () => state.plan?.week.find((w) => w.day === todayName()) || null,
    [state.plan]
  );

  return (
    <div className="grid gap-3 pl-fade">
      <div className="flex items-end justify-between px-1">
        <div>
          <Eyebrow zone="z3">TODAY · {fmtHeader()}</Eyebrow>
          <h2 className="pl-display text-3xl font-bold mt-1">Hello, {state.profile.name.split(" ")[0]}</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <Flame size={15} style={{ color: C.z4 }} />
          <span className="pl-display font-bold">{streak}</span>
          <span className="pl-mono text-[11px]" style={{ color: C.smoke }}>DAY</span>
        </div>
      </div>

      {!state.plan && (
        <button onClick={() => gotoTab("plan")} className="rounded-3xl p-4 flex items-center justify-between text-left"
          style={{ background: C.iron, color: "#fff" }}>
          <div>
            <div className="pl-mono text-xs tracking-widest" style={{ color: C.z3 }}>NEXT STEP</div>
            <div className="pl-display text-xl font-bold mt-0.5">Generate your AI training plan</div>
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
        <div className="pl-mono text-[11px] mt-3 pt-3 flex justify-between" style={{ color: C.smoke, borderTop: `1px solid ${C.line}` }}>
          <span>EATEN {eaten.toLocaleString()}</span><span>TARGET {t.kcal.toLocaleString()}</span><span>TDEE {t.tdee.toLocaleString()}</span>
        </div>
      </Card>

      <CheckinBlock state={state} mutate={mutate} />

      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow zone="z1">BODYWEIGHT</Eyebrow>
          {weights.length >= 2 && (
            <span className="pl-mono text-xs font-semibold" style={{ color: delta <= 0 ? C.z2 : C.z5 }}>
              {delta > 0 ? "+" : ""}{delta} KG / {weights.length}D
            </span>
          )}
        </div>
        {weights.length >= 2 ? (
          <div className="h-28 mt-2 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weights} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <defs>
                  <linearGradient id="plW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.z1} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.z1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: C.faint, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={["dataMin - 0.4", "dataMax + 0.4"]} hide />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: "Barlow", fontSize: 13 }} formatter={(v) => [v + " kg", "Weight"]} labelStyle={{ color: C.smoke }} />
                <Area type="monotone" dataKey="w" stroke={C.z1} strokeWidth={2.5} fill="url(#plW)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm mt-2" style={{ color: C.smoke }}>Log your weight in the morning check-in — the trend appears after two entries.</p>
        )}
      </Card>

      {session && (
        <Card>
          <div className="flex items-center justify-between">
            <Eyebrow zone="z4">TODAY'S SESSION</Eyebrow>
            <button onClick={() => gotoTab("plan")} className="pl-mono text-xs font-semibold" style={{ color: C.z4 }}>FULL PLAN →</button>
          </div>
          <div className="pl-display text-2xl font-bold mt-1.5">{session.focus}</div>
          <div className="mt-2 grid gap-1.5">
            {session.work.map((w, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5 px-3 rounded-lg" style={{ background: C.chalk }}>
                <span className="font-medium">{w.n}</span>
                <span className="pl-mono text-xs self-center" style={{ color: C.smoke }}>{w.d}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- daily check-ins ---------------- */
function CheckinBlock({ state, mutate }) {
  const today = dayISO();
  const done = state.journal[today]?.checkins || {};
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
                  <span className="pl-mono text-xs ml-2" style={{ color: C.faint }}>{s.time}</span>
                </span>
                {isDone
                  ? <span className="pl-mono text-xs" style={{ color: C.z2 }}>LOGGED {done[s.id].at}</span>
                  : s.unlocked
                    ? <span className="pl-mono text-xs font-semibold" style={{ color: C.z4 }}>LOG NOW</span>
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
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const at = nowHM();

  const valid = slot === "morning" ? v.sleep && v.energy
    : slot === "midday" ? v.mood
      : v.rating && v.onPlan !== null;

  const submit = () => {
    mutate((s) => {
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
    <div className="pl-fade rounded-xl p-4 mt-1.5 grid gap-3.5" style={{ background: C.chalk, border: `1px solid ${C.line}` }}>
      {slot === "morning" && (<>
        <Field label="TODAY'S WEIGHT (KG) — OPTIONAL">
          <Input inputMode="decimal" value={v.weight} onChange={(e) => set("weight", e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(state.profile.weight)} />
        </Field>
        <Field label="SLEEP QUALITY"><Scale5 value={v.sleep} onChange={(x) => set("sleep", x)} zone="z1" /></Field>
        <Field label="ENERGY"><Scale5 value={v.energy} onChange={(x) => set("energy", x)} zone="z3" /></Field>
      </>)}
      {slot === "midday" && (<>
        <Field label="MOOD"><Scale5 value={v.mood} onChange={(x) => set("mood", x)} zone="z2" /></Field>
        <Field label="WATER SO FAR (GLASSES)">
          <div className="flex items-center gap-3">
            <Droplets size={18} style={{ color: C.z1 }} />
            <Input inputMode="numeric" value={v.water || ""} onChange={(e) => set("water", e.target.value.replace(/\D/g, ""))} placeholder="4" />
          </div>
        </Field>
      </>)}
      {slot === "evening" && (<>
        <Field label="HOW WAS TODAY?"><Scale5 value={v.rating} onChange={(x) => set("rating", x)} zone="z3" /></Field>
        <Field label="STAYED ON PLAN?">
          <div className="grid grid-cols-2 gap-2">
            {[["Yes", true], ["Mostly not", false]].map(([l, val]) => (
              <button key={l} onClick={() => set("onPlan", val)} className="py-2.5 rounded-lg font-semibold border"
                style={{ background: v.onPlan === val ? (val ? C.z2 : C.z5) : C.card, color: v.onPlan === val ? "#fff" : C.ink, borderColor: v.onPlan === val ? "transparent" : C.line }}>{l}</button>
            ))}
          </div>
        </Field>
        <Field label="NOTE FOR YOUR COACH — OPTIONAL">
          <Input value={v.note} onChange={(e) => set("note", e.target.value)} placeholder="Skipped lunch, big dinner…" />
        </Field>
      </>)}
      <Btn zone="z2" onClick={submit} disabled={!valid} small>Save check-in <Check size={16} /></Btn>
    </div>
  );
}
