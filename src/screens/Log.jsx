import React, { useState } from "react";
import { Dumbbell, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { C } from "../theme.js";
import { Btn, Card, Eyebrow, Input } from "../ui.jsx";
import { apiFood, dayISO, healthFlags } from "../lib.js";
import Scanner from "../Scanner.jsx";

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const guessMeal = () => {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snack";
};

export default function Log({ state, mutate, notify }) {
  const today = dayISO();
  const day = state.journal[today] || { foods: [], workouts: [], checkins: {} };
  const [food, setFood] = useState("");
  const [meal, setMeal] = useState(guessMeal());
  const [busy, setBusy] = useState(false);
  const [wo, setWo] = useState({ name: "", mins: "" });

  const write = (fn) => mutate((s) => {
    const d = s.journal[today] || { foods: [], workouts: [], checkins: {} };
    return { ...s, journal: { ...s.journal, [today]: fn(d) } };
  });

  const addFood = async () => {
    const desc = food.trim();
    if (!desc || busy) return;
    setBusy(true);
    let item;
    try {
      item = await apiFood(desc, meal);
    } catch {
      item = { name: desc.slice(0, 48), kcal: 300, p: 12, c: 35, f: 10, est: true };
      notify("Coach AI unreachable — added a rough 300 kcal estimate you can delete.");
    }
    write((d) => ({ ...d, foods: [...d.foods, { id: String(Date.now()), meal, ...item }] }));
    setFood(""); setBusy(false);
  };

  const addScan = (r) => {
    write((d) => ({ ...d, foods: [...d.foods, { id: String(Date.now()), meal, name: r.dish, kcal: r.kcal, p: r.p, c: r.c, f: r.f }] }));
    notify(`Logged "${r.dish}" — ${r.kcal.toLocaleString()} kcal (${meal}).`);
  };

  const addWorkout = () => {
    if (!wo.name.trim()) return;
    write((d) => ({ ...d, workouts: [...d.workouts, { id: String(Date.now()), name: wo.name.trim(), mins: +wo.mins || 0 }] }));
    setWo({ name: "", mins: "" });
  };

  const grouped = MEALS.map((m) => [m, day.foods.filter((f) => f.meal === m)]);

  return (
    <div className="grid gap-3 pl-fade">
      <div className="flex gap-1.5 px-1">
        {MEALS.map((m) => (
          <button key={m} onClick={() => setMeal(m)} className="px-3 py-1.5 text-xs font-bold capitalize border"
            style={{ background: meal === m ? C.iron : C.card, color: meal === m ? "#fff" : C.smoke, borderColor: meal === m ? C.iron : C.line, boxShadow: meal === m ? `0 2px 0 0 ${C.z3}` : "none" }}>
            {m}
          </button>
        ))}
      </div>

      <Scanner onLogged={addScan} health={healthFlags(state.health)} />

      <Card>
        <Eyebrow zone="z3">OR TYPE IT · AI-PARSED</Eyebrow>
        <div className="flex gap-2 mt-3">
          <Input value={food} onChange={(e) => setFood(e.target.value)} placeholder="e.g. chicken rice, less rice"
            onKeyDown={(e) => e.key === "Enter" && addFood()} />
          <Btn zone="z3" onClick={addFood} disabled={busy || !food.trim()} small className="shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Add
          </Btn>
        </div>
        {busy && <div className="pl-mono text-xs mt-2 pl-pulse" style={{ color: C.z3 }}>COACH IS ESTIMATING MACROS…</div>}
        <div className="mt-3 grid gap-3">
          {grouped.map(([m, items]) => items.length > 0 && (
            <div key={m}>
              <div className="pl-mono text-[11px] tracking-wider" style={{ color: C.faint }}>{m.toUpperCase()}</div>
              {items.map((f) => (
                <div key={f.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${C.chalk}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{f.name}{f.est && <span className="pl-mono text-xs ml-1" style={{ color: C.z5 }}>~EST</span>}</div>
                    <div className="pl-mono text-[11px]" style={{ color: C.smoke }}>P{f.p} C{f.c} F{f.f}</div>
                  </div>
                  <div className="pl-display text-lg font-bold shrink-0">{f.kcal.toLocaleString()}<span className="text-xs font-medium" style={{ color: C.faint }}> kcal</span></div>
                  <button aria-label={`delete ${f.name}`} onClick={() => write((d) => ({ ...d, foods: d.foods.filter((x) => x.id !== f.id) }))}
                    className="p-1.5 rounded-lg shrink-0" style={{ color: C.faint }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          ))}
          {day.foods.length === 0 && <p className="text-sm" style={{ color: C.smoke }}>Nothing logged yet. Scan a photo above or type a meal — the AI estimates calories and macros.</p>}
        </div>
      </Card>

      <Card>
        <Eyebrow zone="z4">TRAINING LOG</Eyebrow>
        <div className="flex gap-2 mt-3">
          <Input value={wo.name} onChange={(e) => setWo((p) => ({ ...p, name: e.target.value }))} placeholder="Session — e.g. Push day" />
          <Input value={wo.mins} onChange={(e) => setWo((p) => ({ ...p, mins: e.target.value.replace(/\D/g, "") }))} placeholder="min" className="w-20 shrink-0" inputMode="numeric" />
          <Btn zone="z4" onClick={addWorkout} disabled={!wo.name.trim()} small className="shrink-0" aria-label="add workout"><Plus size={16} /></Btn>
        </div>
        <div className="mt-3 grid gap-1.5">
          {day.workouts.map((w) => (
            <div key={w.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.chalk }}>
              <Dumbbell size={15} style={{ color: C.z4 }} />
              <span className="flex-1 text-sm font-medium">{w.name}</span>
              {w.mins > 0 && <span className="pl-mono text-xs" style={{ color: C.smoke }}>{w.mins} MIN</span>}
              <button aria-label={`delete ${w.name}`} onClick={() => write((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) }))}
                className="p-1" style={{ color: C.faint }}><Trash2 size={14} /></button>
            </div>
          ))}
          {day.workouts.length === 0 && <p className="text-sm" style={{ color: C.smoke }}>No sessions logged today.</p>}
        </div>
      </Card>
    </div>
  );
}
