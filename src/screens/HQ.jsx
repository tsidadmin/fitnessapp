import React, { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { C } from "../theme.js";
import { Btn, Card, Eyebrow } from "../ui.jsx";
import { GOALS, dayISO, shiftISO } from "../lib.js";

const DEMO_CLIENTS = [
  { name: "Priya M.", goal: "CUT", compliance: 92, delta: -1.4, alerts: [] },
  { name: "Marcus L.", goal: "BUILD", compliance: 64, delta: 0.6, alerts: ["2 missed evening check-ins"] },
  { name: "Wen Jie", goal: "HOLD", compliance: 78, delta: -0.2, alerts: ["No workout logged in 4 days"] },
];

export default function HQ({ state, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const last7 = [...Array(7)].map((_, i) => shiftISO(-i));
  const daysWithData = last7.filter((iso) => {
    const d = state.journal[iso];
    return d && (Object.keys(d.checkins || {}).length >= 2 || d.foods.length >= 2);
  }).length;
  const compliance = Math.round((daysWithData / 7) * 100);

  const alerts = [];
  const yest = state.journal[shiftISO(-1)];
  if (!yest?.checkins?.evening) alerts.push("No evening check-in yesterday");
  const today = state.journal[dayISO()];
  if (!today || today.foods.length === 0) alerts.push("No food logged yet today");

  const weights = Object.entries(state.journal).filter(([, d]) => d.weight).sort(([a], [b]) => a.localeCompare(b));
  const delta = weights.length >= 2 ? +(weights[weights.length - 1][1].weight - weights[0][1].weight).toFixed(1) : 0;

  const you = { name: state.profile.name + " (live)", goal: (GOALS.find((g) => g.id === state.profile.goal) || {}).tag, compliance, delta, alerts, live: true };
  const clients = [you, ...DEMO_CLIENTS];

  return (
    <div className="grid gap-3 pl-fade">
      <div className="px-1">
        <Eyebrow zone="z5">TRAINER HQ</Eyebrow>
        <h2 className="pl-display text-3xl font-bold mt-1">Client board</h2>
        <p className="text-sm mt-1" style={{ color: C.smoke }}>
          Every check-in and log streams here in real time — intervene when needed, not always.
        </p>
      </div>

      {clients.map((c, i) => (
        <Card key={i} style={c.live ? { boxShadow: `inset 0 0 0 2px ${C.z2}` } : {}}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center pl-display text-lg font-bold"
              style={{ background: C.iron, color: "#fff" }}>{c.name[0]}</span>
            <div className="flex-1">
              <div className="font-semibold">{c.name}
                {c.live && <span className="pl-mono text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: C.z2, color: "#fff" }}>LIVE</span>}
              </div>
              <div className="pl-mono text-xs" style={{ color: C.smoke }}>{c.goal} · {c.delta > 0 ? "+" : ""}{c.delta} KG</div>
            </div>
            <div className="text-right">
              <div className="pl-display text-2xl font-bold" style={{ color: c.compliance >= 80 ? C.z2 : c.compliance >= 60 ? C.z3 : C.z5 }}>{c.compliance}%</div>
              <div className="pl-mono text-[11px]" style={{ color: C.faint }}>7D ADHERENCE</div>
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
    </div>
  );
}
