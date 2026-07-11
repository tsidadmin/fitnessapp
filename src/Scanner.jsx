import React, { useRef, useState } from "react";
import { Camera, Check, Flame, HeartPulse, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { C } from "./theme.js";
import { useCountUp } from "./ui.jsx";
import { apiAnalyzePhoto, fileToJpeg } from "./lib.js";

const AMBER = "#F59E0B";
const VERDICT = {
  good: { color: C.z2, label: "GOOD FOR YOU", tint: "rgba(16,185,129,.16)" },
  moderate: { color: AMBER, label: "IN MODERATION", tint: "rgba(245,158,11,.16)" },
  limit: { color: C.z5, label: "GO EASY", tint: "rgba(229,72,77,.16)" },
};

const ERROR_COPY = {
  server_not_configured: "The scanner isn't wired to an AI key yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.",
  bad_api_key: "The server's AI key was rejected — check ANTHROPIC_API_KEY in Vercel.",
  rate_limited: "The AI is catching its breath — try again in a few seconds.",
  not_food: "No food detected in that shot. Try a clearer, closer photo of the plate.",
  bad_image: "Couldn't read that image file. Try a JPEG or PNG.",
  analysis_failed: "Analysis failed. Check your connection and try again.",
};

const MacroChip = ({ label, grams, color }) => (
  <div className="flex-1 px-3 py-2 text-center" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
    <div className="pl-display text-xl font-bold leading-none" style={{ color }}>{grams}<span className="text-xs font-medium" style={{ color: "rgba(255,255,255,.45)" }}>g</span></div>
    <div className="pl-mono text-[10px] tracking-[.15em] mt-1" style={{ color: "rgba(255,255,255,.45)" }}>{label}</div>
  </div>
);

function KcalBig({ value }) {
  const n = useCountUp(value);
  return (
    <div className="flex items-baseline gap-2">
      <span className="pl-display font-bold leading-none" style={{ fontSize: 60, color: "#fff" }}>{n.toLocaleString()}</span>
      <span className="pl-mono text-sm" style={{ color: C.z3 }}>KCAL</span>
    </div>
  );
}

export default function Scanner({ onLogged, health = "" }) {
  const [phase, setPhase] = useState("idle"); // idle | busy | result | error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errKey, setErrKey] = useState("analysis_failed");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || phase === "busy") return;
    setPhase("busy"); setResult(null);
    try {
      const dataUrl = await fileToJpeg(file);
      setPreview(dataUrl);
      const data = await apiAnalyzePhoto(dataUrl, health);
      if (!data.is_food) { setErrKey("not_food"); setPhase("error"); return; }
      setResult({
        dish: String(data.dish || "Mystery plate").slice(0, 48),
        kcal: Math.max(0, Math.round(+data.kcal || 0)),
        p: Math.max(0, Math.round(+data.protein || 0)),
        c: Math.max(0, Math.round(+data.carbs || 0)),
        f: Math.max(0, Math.round(+data.fat || 0)),
        items: Array.isArray(data.items) ? data.items.slice(0, 6) : [],
        note: String(data.note || ""),
        verdict: VERDICT[data.verdict] ? data.verdict : null,
        verdictReason: String(data.verdict_reason || ""),
        swap: String(data.better_swap || ""),
      });
      setPhase("result");
    } catch (e) {
      setErrKey(ERROR_COPY[e.message] ? e.message : "analysis_failed");
      setPhase("error");
    }
  };

  const reset = () => { setPhase("idle"); setPreview(null); setResult(null); };
  const logIt = () => { onLogged(result); reset(); };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer?.files?.[0]); };

  return (
    <section className="p-5 pl-fade pl-grid-bg" style={{ backgroundColor: C.iron, color: "#fff", boxShadow: "0 16px 40px rgba(0,2,103,.18)" }}>
      <div className="flex items-center justify-between">
        <div className="pl-mono flex items-center gap-2 text-[11px] font-medium tracking-[.18em]" style={{ color: "rgba(255,255,255,.45)" }}>
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: C.z3 }} />
          FUEL SCANNER · AI VISION
        </div>
        <Flame size={16} style={{ color: C.z3 }} />
      </div>

      {phase === "idle" && (
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className="relative mt-4 w-full flex flex-col items-center justify-center gap-2 py-8 transition-colors pl-fade"
          style={{
            border: `1px dashed ${drag ? C.z3 : "rgba(255,255,255,.3)"}`,
            background: drag ? "rgba(79,195,247,.12)" : "rgba(255,255,255,.04)",
          }}>
          <i className="plc tl" /><i className="plc tr" /><i className="plc bl" /><i className="plc br" />
          <span className="p-3.5" style={{ background: C.z4, boxShadow: `0 3px 0 0 ${C.z3}` }}><Camera size={22} color="#fff" /></span>
          <span className="font-semibold text-sm">Snap a meal photo</span>
          <span className="pl-mono text-[11px] tracking-wider" style={{ color: "rgba(255,255,255,.4)" }}>AI NAMES THE DISH & COUNTS THE KCAL</span>
        </button>
      )}

      {phase === "busy" && (
        <div className="mt-4 pl-fade">
          <div className="relative overflow-hidden" style={{ maxHeight: 320, border: "1px solid rgba(79,195,247,.35)" }}>
            {preview
              ? <img src={preview} alt="your meal" className="w-full object-cover" style={{ maxHeight: 320 }} />
              : <div className="w-full flex items-center justify-center" style={{ height: 180, background: "rgba(255,255,255,.05)" }}>
                  <Loader2 size={22} className="animate-spin" style={{ color: C.z3 }} />
                </div>}
            <div className="pl-scanline" />
          </div>
          <div className="pl-mono text-xs tracking-[.18em] mt-3 pl-pulse" style={{ color: C.z3 }}>READING YOUR PLATE…</div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="mt-4 pl-fade">
          <div className="flex gap-3 items-start">
            {preview && <img src={preview} alt={result.dish} className="rounded-xl object-cover shrink-0" style={{ width: 84, height: 84 }} />}
            <div className="min-w-0">
              <div className="font-semibold text-lg leading-snug">{result.dish}</div>
              {result.note && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.5)" }}>{result.note}</p>}
            </div>
          </div>
          <div className="mt-4"><KcalBig value={result.kcal} /></div>
          <div className="flex gap-2 mt-4">
            <MacroChip label="PROTEIN" grams={result.p} color={C.z2} />
            <MacroChip label="CARBS" grams={result.c} color={C.z3} />
            <MacroChip label="FAT" grams={result.f} color={C.z1} />
          </div>
          {result.items.length > 1 && (
            <div className="mt-4 px-3.5 py-2.5" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
              {result.items.map((it, i) => (
                <div key={i} className="flex justify-between py-1 pl-mono text-xs" style={{ color: "rgba(255,255,255,.65)" }}>
                  <span className="truncate pr-3">{it.name}</span>
                  <span className="shrink-0" style={{ color: C.z3 }}>{Math.round(+it.kcal || 0)} kcal</span>
                </div>
              ))}
            </div>
          )}

          {result.verdict && (
            <div className="mt-4 px-3.5 py-3" style={{ background: VERDICT[result.verdict].tint, borderLeft: `3px solid ${VERDICT[result.verdict].color}` }}>
              <div className="pl-mono flex items-center gap-1.5 text-[11px] font-semibold tracking-[.15em]" style={{ color: VERDICT[result.verdict].color }}>
                <HeartPulse size={12} /> {VERDICT[result.verdict].label} · VS YOUR REPORT
              </div>
              {result.verdictReason && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,.85)" }}>{result.verdictReason}</p>}
              {result.swap && (
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,.7)" }}>
                  <span className="pl-mono text-[11px] tracking-wider" style={{ color: C.z3 }}>TRY&nbsp;→&nbsp;</span>{result.swap}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button onClick={logIt} className="flex-1 py-3 font-bold inline-flex items-center justify-center gap-2 text-sm" style={{ background: C.z4, color: "#fff", boxShadow: `0 3px 0 0 ${C.z3}` }}>
              <Check size={16} /> Add to today
            </button>
            <button onClick={reset} className="px-4 py-3 font-bold inline-flex items-center gap-2 text-sm" style={{ border: "1px solid rgba(255,255,255,.3)", color: "rgba(255,255,255,.85)" }}>
              <RotateCcw size={15} /> Retake
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-4 pl-fade">
          {preview && errKey === "not_food" && <img src={preview} alt="" className="rounded-xl w-full object-cover mb-3 opacity-60" style={{ maxHeight: 180 }} />}
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(196,69,54,.15)", border: `1px solid ${C.z5}`, color: "#F3C3BC" }}>
            {ERROR_COPY[errKey]}
          </div>
          <button onClick={reset} className="mt-3 px-4 py-2.5 font-bold inline-flex items-center gap-2 text-sm" style={{ border: "1px solid rgba(255,255,255,.3)" }}>
            <ImagePlus size={15} /> Try another photo
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
    </section>
  );
}
