import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { C } from "../theme.js";
import { Btn, Card, Input } from "../ui.jsx";
import { apiChat, dayISO, healthFlags, todayName } from "../lib.js";

export default function Coach({ state, mutate }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.chat, busy]);

  const context = () => {
    const d = state.journal[dayISO()] || { foods: [], workouts: [], checkins: {} };
    return {
      name: state.profile.name, age: state.profile.age, sex: state.profile.sex,
      height: state.profile.height, weight: state.profile.weight,
      goal: state.profile.goal, days: state.profile.days,
      kcal: state.targets.kcal, protein: state.targets.protein,
      eaten: d.foods.reduce((s, f) => s + f.kcal, 0),
      eatenProtein: d.foods.reduce((s, f) => s + f.p, 0),
      workouts: d.workouts.length,
      focus: state.plan?.week.find((w) => w.day === todayName())?.focus || "",
      health: healthFlags(state.health),
    };
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput("");
    const history = [...state.chat, { role: "user", content: q }];
    mutate((s) => ({ ...s, chat: [...s.chat, { role: "user", content: q }] }));
    setBusy(true);
    try {
      const reply = await apiChat(context(), history.slice(-10));
      mutate((s) => ({ ...s, chat: [...s.chat, { role: "assistant", content: reply }] }));
    } catch {
      mutate((s) => ({ ...s, chat: [...s.chat, { role: "assistant", content: "I couldn't reach the coaching engine just now. Try again in a moment — your logs are all saved." }] }));
    }
    setBusy(false);
  };

  const chips = ["What should I eat for dinner?", "I missed today's workout", "Why is my weight up today?"];

  return (
    <div className="pl-fade flex flex-col" style={{ height: "calc(100vh - 200px)", minHeight: 380 }}>
      <div className="pl-chat flex-1 overflow-y-auto grid gap-2.5 content-start pr-1">
        {state.chat.length === 0 && (
          <Card className="text-center py-8">
            <MessageCircle className="mx-auto" style={{ color: C.z1 }} />
            <h3 className="pl-display text-2xl font-bold mt-2">Ask your coach anything</h3>
            <p className="text-sm mt-1" style={{ color: C.smoke }}>It already knows your goal, targets and today's logs.</p>
          </Card>
        )}
        {state.chat.map((m, i) => (
          <div key={i} className={"max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " + (m.role === "user" ? "justify-self-end" : "justify-self-start")}
            style={m.role === "user"
              ? { background: C.iron, color: "#fff", borderBottomRightRadius: 6 }
              : { background: C.card, border: `1px solid ${C.line}`, borderBottomLeftRadius: 6 }}>
            {m.role === "assistant" && <div className="pl-mono text-xs mb-1" style={{ color: C.z1 }}>COACH</div>}
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="justify-self-start rounded-2xl px-3.5 py-2.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <span className="pl-mono text-xs pl-pulse" style={{ color: C.z1 }}>COACH IS TYPING…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {state.chat.length === 0 && (
        <div className="flex flex-wrap gap-1.5 py-2">
          {chips.map((c) => (
            <button key={c} onClick={() => send(c)} className="px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{ background: C.card, borderColor: C.line, color: C.smoke }}>{c}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message your coach…"
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <Btn zone="z1" onClick={() => send()} disabled={busy || !input.trim()} small className="shrink-0" aria-label="send">
          <Send size={16} />
        </Btn>
      </div>
    </div>
  );
}
