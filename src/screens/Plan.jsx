import React, { useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { C } from "../theme.js";
import { Btn, Card, Eyebrow, ZoneMark } from "../ui.jsx";
import { apiPlan, dayISO, fallbackPlan, todayName } from "../lib.js";

export default function Plan({ state, mutate, notify }) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    let plan;
    try {
      plan = await apiPlan(state.profile, state.targets);
    } catch {
      plan = fallbackPlan(state.profile, state.targets);
      notify("Coach AI unreachable — loaded the built-in template plan instead.");
    }
    mutate((s) => ({ ...s, plan }));
    setBusy(false);
  };

  const markDone = (w) => {
    mutate((s) => {
      const today = dayISO();
      const d = s.journal[today] || { foods: [], workouts: [], checkins: {} };
      return { ...s, journal: { ...s.journal, [today]: { ...d, workouts: [...d.workouts, { id: String(Date.now()), name: w.focus + " (plan)", mins: 45 }] } } };
    });
    notify("Session logged — nice work.");
  };

  if (!state.plan) {
    return (
      <div className="pl-fade">
        <Card className="text-center py-10">
          <div className="flex justify-center"><ZoneMark h={26} /></div>
          <h2 className="pl-display text-3xl font-bold mt-4">Your week, written by AI</h2>
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
    <div className="grid gap-3 pl-fade">
      <Card style={{ background: C.iron, borderColor: C.iron }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="pl-mono text-xs tracking-widest" style={{ color: C.z3 }}>
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
        const isToday = w.day === todayName();
        const isRest = /recover/i.test(w.focus);
        return (
          <Card key={w.day} style={isToday ? { boxShadow: `inset 0 0 0 2px ${C.z4}` } : {}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="pl-display text-lg font-bold w-11 text-center py-0.5 rounded-lg"
                  style={{ background: isToday ? C.z4 : C.chalk, color: isToday ? "#fff" : C.smoke }}>{w.day}</span>
                <span className="font-semibold">{w.focus}</span>
              </div>
              <span className="pl-mono text-xs" style={{ color: isRest ? C.z1 : C.z4 }}>{isRest ? "Z1" : "Z4"}</span>
            </div>
            <div className="mt-2.5 grid gap-1">
              {w.work.map((x, i) => (
                <div key={i} className="flex justify-between text-sm py-1" style={{ borderBottom: i < w.work.length - 1 ? `1px solid ${C.chalk}` : "none" }}>
                  <span>{x.n}</span>
                  <span className="pl-mono text-xs self-center" style={{ color: C.smoke }}>{x.d}</span>
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
              <span className="pl-display font-bold" style={{ color: C.z2 }}>{String(i + 1).padStart(2, "0")}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
