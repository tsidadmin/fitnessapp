import React, { useState } from "react";
import { ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";
import { C } from "./theme.js";
import { Btn, Eyebrow, Field, Input, ZoneMark } from "./ui.jsx";
import { ACTIVITY, GOALS, computeTargets } from "./lib.js";

const PreviewTargets = ({ p }) => {
  const t = computeTargets({ ...p, age: +p.age || 30, height: +p.height || 170, weight: +p.weight || 70 });
  return (
    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
      {[["BMR", t.bmr], ["TDEE", t.tdee], ["TARGET", t.kcal]].map(([k, v]) => (
        <div key={k}>
          <div className="pl-display text-2xl font-bold">{v.toLocaleString()}</div>
          <div className="pl-mono text-[11px]" style={{ color: C.smoke }}>{k} KCAL</div>
        </div>
      ))}
    </div>
  );
};

const Choice = ({ items, value, onPick, zone }) => (
  <div className="grid grid-cols-1 gap-2">
    {items.map((it) => {
      const active = value === it.id;
      return (
        <button key={it.id} onClick={() => onPick(it.id)}
          className="flex items-center justify-between rounded-xl px-4 py-3 border text-left"
          style={{ background: C.card, borderColor: active ? C[zone] : C.line, boxShadow: active ? `inset 0 0 0 1px ${C[zone]}` : "none" }}>
          <span className="font-semibold">{it.label}</span>
          {active && <Check size={18} style={{ color: C[zone] }} />}
        </button>
      );
    })}
  </div>
);

export default function Onboarding({ onDone, onDemo }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ name: "", age: "", sex: "male", height: "", weight: "", activity: "light", goal: "lose", days: 4 });
  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));
  const num = (v) => (v === "" ? "" : String(v).replace(/[^\d.]/g, ""));

  const canNext = step === 0 ? true
    : step === 1 ? p.name.trim() && +p.age >= 14 && +p.age <= 90
      : step === 2 ? +p.height >= 120 && +p.height <= 230 && +p.weight >= 35 && +p.weight <= 250
        : true;

  const finish = () => onDone({ ...p, age: +p.age, height: +p.height, weight: +p.weight, name: p.name.trim() });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.iron }}>
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-5 pt-10 pb-8">
        <div className="flex items-center gap-3">
          <ZoneMark h={22} />
          <span className="pl-display text-2xl font-bold tracking-wide" style={{ color: "#fff" }}>PULSECOACH</span>
        </div>

        {step === 0 && (
          <div className="pl-fade flex-1 flex flex-col justify-center">
            <div className="pl-mono text-xs tracking-widest mb-3" style={{ color: C.z3 }}>AI FITNESS ADVISOR</div>
            <h1 className="pl-display font-bold leading-none" style={{ color: "#fff", fontSize: 52 }}>
              Your coach,<br />on every rep,<br />every meal.
            </h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "#B9C2BB" }}>
              Onboard in a minute. PulseCoach computes your calorie and macro targets, scans
              your meals from a photo, writes your weekly plan with AI, and checks in three
              times a day.
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
          <div className="pl-fade flex-1 flex flex-col rounded-2xl mt-6 p-5" style={{ background: C.chalk }}>
            <div className="pl-mono text-xs tracking-widest" style={{ color: C.smoke }}>STEP {step} / 3</div>
            {step === 1 && (
              <div className="mt-3 grid gap-4">
                <h2 className="pl-display text-3xl font-bold">About you</h2>
                <Field label="FIRST NAME"><Input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Alex" /></Field>
                <Field label="AGE"><Input inputMode="numeric" value={p.age} onChange={(e) => set("age", num(e.target.value))} placeholder="32" /></Field>
                <Field label="SEX (FOR THE BMR FORMULA)">
                  <div className="grid grid-cols-2 gap-2">
                    {["male", "female"].map((s) => (
                      <button key={s} onClick={() => set("sex", s)} className="py-3 rounded-xl font-semibold capitalize border"
                        style={{ background: p.sex === s ? C.iron : C.card, color: p.sex === s ? "#fff" : C.ink, borderColor: p.sex === s ? C.iron : C.line }}>{s}</button>
                    ))}
                  </div>
                </Field>
              </div>
            )}
            {step === 2 && (
              <div className="mt-3 grid gap-4">
                <h2 className="pl-display text-3xl font-bold">Body + activity</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="HEIGHT (CM)"><Input inputMode="decimal" value={p.height} onChange={(e) => set("height", num(e.target.value))} placeholder="173" /></Field>
                  <Field label="WEIGHT (KG)"><Input inputMode="decimal" value={p.weight} onChange={(e) => set("weight", num(e.target.value))} placeholder="78" /></Field>
                </div>
                <Field label="TYPICAL DAY"><Choice items={ACTIVITY} value={p.activity} onPick={(v) => set("activity", v)} zone="z1" /></Field>
              </div>
            )}
            {step === 3 && (
              <div className="mt-3 grid gap-4">
                <h2 className="pl-display text-3xl font-bold">Your goal</h2>
                <Choice items={GOALS} value={p.goal} onPick={(v) => set("goal", v)} zone="z4" />
                <Field label="TRAINING DAYS / WEEK">
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 4, 5].map((d) => (
                      <button key={d} onClick={() => set("days", d)} className="py-3 rounded-xl pl-display text-xl font-bold border"
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
