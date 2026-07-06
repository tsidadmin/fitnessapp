import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, LayoutGrid, MessageCircle, User, Utensils, X } from "lucide-react";
import { C } from "./theme.js";
import { ZoneMark } from "./ui.jsx";
import { computeTargets, loadState, migrateLens, saveState, clearState, seedDemo } from "./lib.js";
import Onboarding from "./Onboarding.jsx";
import Today from "./screens/Today.jsx";
import Log from "./screens/Log.jsx";
import Plan from "./screens/Plan.jsx";
import Coach from "./screens/Coach.jsx";
import HQ from "./screens/HQ.jsx";

const TABS = [
  { id: "today", label: "TODAY", icon: LayoutGrid },
  { id: "log", label: "LOG", icon: Utensils },
  { id: "plan", label: "PLAN", icon: CalendarDays },
  { id: "coach", label: "COACH", icon: MessageCircle },
  { id: "hq", label: "HQ", icon: User },
];

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => { if (state) saveState(state); }, [state]);

  const mutate = (fn) => setState((s) => fn(s));

  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const onboard = (profile) => {
    const targets = computeTargets(profile);
    setState(migrateLens({ profile, targets, plan: null, journal: {}, chat: [], created: Date.now() }));
  };

  const reset = () => { clearState(); setState(null); setTab("today"); };

  if (!state) {
    return <Onboarding onDone={onboard} onDemo={() => setState(migrateLens(seedDemo()))} />;
  }

  return (
    <div className="min-h-screen" style={{ background: C.chalk }}>
      <header className="sticky top-0 z-10 px-5 py-3.5 flex items-center justify-between" style={{ background: C.iron, color: "#fff" }}>
        <div className="flex items-center gap-2.5">
          <ZoneMark h={18} />
          <span className="pl-display font-bold tracking-wide text-lg">PULSECOACH</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="pl-mono text-[11px] tracking-[.15em]" style={{ color: C.z3 }}>
            {state.targets.kcal.toLocaleString()} KCAL / DAY
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 pb-28">
        {tab === "today" && <Today state={state} mutate={mutate} gotoTab={setTab} />}
        {tab === "log" && <Log state={state} mutate={mutate} notify={notify} />}
        {tab === "plan" && <Plan state={state} mutate={mutate} notify={notify} />}
        {tab === "coach" && <Coach state={state} mutate={mutate} />}
        {tab === "hq" && <HQ state={state} onReset={reset} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10" style={{ background: C.iron }}>
        <div className="max-w-md mx-auto flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 flex flex-col items-center gap-1 pt-3 pb-4"
                style={{ color: active ? C.z2 : "#8B958D" }}>
                <Icon size={19} />
                <span className="pl-mono text-[10px] tracking-wider" style={active ? { borderBottom: `2px solid ${C.z2}`, paddingBottom: 2 } : {}}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 pl-fade flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: C.iron, color: "#fff", maxWidth: "92vw" }}>
          {toast}
          <button aria-label="dismiss" onClick={() => setToast(null)} style={{ color: C.faint }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
