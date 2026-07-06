import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Flame, ImagePlus, Loader2, RotateCcw, Trash2, X } from "lucide-react";

/* ================================================================
   PULSECOACH LENS — snap a meal, know the damage.
   Photo -> Vercel function -> Claude vision -> dish + kcal + macros.
   Log persists in localStorage on this device.
   ================================================================ */

const C = {
  chalk: "#F2F3EF", card: "#FFFFFF", iron: "#1F2823", iron2: "#2A352E",
  ink: "#232B26", smoke: "#6C766E", faint: "#9AA39B", line: "#E2E6DF",
  z1: "#4E7CB8", z2: "#3E9B6E", z3: "#D9A62E", z4: "#DE7130", z5: "#C44536",
};

const LOG_KEY = "pulselens_log_v1";
const TARGET_KEY = "pulselens_target_v1";

const dayISO = (shift = 0) => {
  const d = new Date(); d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};
const fmtDate = () => {
  const d = new Date();
  return d.toLocaleDateString("en", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();
};
const fmtTime = () => new Date().toTimeString().slice(0, 5);

const loadJSON = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

/* Downscale a photo to a JPEG data URL so uploads stay small and cheap. */
function fileToJpeg(file, maxEdge = 1568) {
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

async function analyzePhoto(dataUrl) {
  const res = await fetch("/api/analyze-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl.split(",")[1], media_type: "image/jpeg" }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "analysis_failed");
  return data;
}

const ERROR_COPY = {
  server_not_configured: "The scanner isn't wired to an AI key yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.",
  bad_api_key: "The server's AI key was rejected — check ANTHROPIC_API_KEY in Vercel.",
  rate_limited: "The AI is catching its breath — try again in a few seconds.",
  not_food: "No food detected in that shot. Try a clearer, closer photo of the plate.",
  bad_image: "Couldn't read that image file. Try a JPEG or PNG.",
  analysis_failed: "Analysis failed. Check your connection and try again.",
};

function useCountUp(target, ms = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* ---------------- small pieces ---------------- */
const Eyebrow = ({ color = C.z3, children }) => (
  <div className="pl-mono flex items-center gap-2 text-[11px] font-medium tracking-[.18em]" style={{ color: C.faint }}>
    <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
    <span>{children}</span>
  </div>
);

const MacroChip = ({ label, grams, color }) => (
  <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
    <div className="pl-display text-xl font-bold leading-none" style={{ color }}>{grams}<span className="text-xs font-medium" style={{ color: "rgba(255,255,255,.45)" }}>g</span></div>
    <div className="pl-mono text-[10px] tracking-[.15em] mt-1" style={{ color: "rgba(255,255,255,.45)" }}>{label}</div>
  </div>
);

function KcalBig({ value }) {
  const n = useCountUp(value);
  return (
    <div className="flex items-baseline gap-2">
      <span className="pl-display font-bold leading-none" style={{ fontSize: 64, color: "#fff" }}>{n.toLocaleString()}</span>
      <span className="pl-mono text-sm" style={{ color: C.z3 }}>KCAL</span>
    </div>
  );
}

/* ---------------- scanner (hero) ---------------- */
function Scanner({ onLogged }) {
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
      const data = await analyzePhoto(dataUrl);
      if (!data.is_food) { setErrKey("not_food"); setPhase("error"); return; }
      setResult({
        dish: String(data.dish || "Mystery plate").slice(0, 48),
        kcal: Math.max(0, Math.round(+data.kcal || 0)),
        p: Math.max(0, Math.round(+data.protein || 0)),
        c: Math.max(0, Math.round(+data.carbs || 0)),
        f: Math.max(0, Math.round(+data.fat || 0)),
        items: Array.isArray(data.items) ? data.items.slice(0, 6) : [],
        note: String(data.note || ""),
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
    <section className="rounded-3xl p-5 pl-fade" style={{ background: C.iron, color: "#fff" }}>
      <div className="flex items-center justify-between">
        <Eyebrow color={C.z3}>FUEL SCANNER · AI VISION</Eyebrow>
        <Flame size={16} style={{ color: C.z3 }} />
      </div>

      {phase === "idle" && (
        <div className="pl-fade">
          <h1 className="pl-display text-3xl font-bold mt-3 leading-tight">What's on<br />your plate?</h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,.55)" }}>
            Snap or drop a photo. The coach names the dish and counts the calories for you.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className="mt-4 w-full rounded-2xl flex flex-col items-center justify-center gap-2 py-10 transition-colors"
            style={{
              border: `2px dashed ${drag ? C.z3 : "rgba(255,255,255,.25)"}`,
              background: drag ? "rgba(217,166,46,.12)" : "rgba(255,255,255,.04)",
            }}>
            <span className="rounded-full p-3.5" style={{ background: C.z3 }}><Camera size={22} color="#fff" /></span>
            <span className="font-semibold text-sm">Snap a meal photo</span>
            <span className="pl-mono text-[11px] tracking-wider" style={{ color: "rgba(255,255,255,.4)" }}>TAP · OR DRAG & DROP</span>
          </button>
        </div>
      )}

      {phase === "busy" && (
        <div className="mt-4 pl-fade">
          <div className="relative rounded-2xl overflow-hidden" style={{ maxHeight: 320 }}>
            {preview
              ? <img src={preview} alt="your meal" className="w-full object-cover" style={{ maxHeight: 320 }} />
              : <div className="w-full flex items-center justify-center" style={{ height: 200, background: "rgba(255,255,255,.05)" }}>
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
            <div className="mt-4 rounded-xl px-3.5 py-2.5" style={{ background: "rgba(255,255,255,.05)" }}>
              {result.items.map((it, i) => (
                <div key={i} className="flex justify-between py-1 pl-mono text-xs" style={{ color: "rgba(255,255,255,.65)" }}>
                  <span className="truncate pr-3">{it.name}</span>
                  <span className="shrink-0" style={{ color: C.z3 }}>{Math.round(+it.kcal || 0)} kcal</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-5">
            <button onClick={logIt} className="flex-1 rounded-xl py-3 font-semibold inline-flex items-center justify-center gap-2 text-sm" style={{ background: C.z2, color: "#fff" }}>
              <Check size={16} /> Add to today
            </button>
            <button onClick={reset} className="rounded-xl px-4 py-3 font-semibold inline-flex items-center gap-2 text-sm" style={{ border: "1px solid rgba(255,255,255,.25)", color: "rgba(255,255,255,.8)" }}>
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
          <button onClick={reset} className="mt-3 rounded-xl px-4 py-2.5 font-semibold inline-flex items-center gap-2 text-sm" style={{ border: "1px solid rgba(255,255,255,.25)" }}>
            <ImagePlus size={15} /> Try another photo
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
    </section>
  );
}

/* ---------------- today's log ---------------- */
function TodayLog({ log, target, setTarget, onDelete }) {
  const today = dayISO();
  const entries = log[today] || [];
  const total = entries.reduce((s, e) => s + e.kcal, 0);
  const pct = Math.min(1, target > 0 ? total / target : 0);
  const over = total > target && target > 0;

  return (
    <section className="rounded-3xl p-5 pl-fade" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between">
        <Eyebrow color={C.z2}>TODAY'S FUEL</Eyebrow>
        <label className="pl-mono text-[11px] tracking-wider flex items-center gap-1.5" style={{ color: C.faint }}>
          TARGET
          <input
            value={target} inputMode="numeric" aria-label="daily kcal target"
            onChange={(e) => setTarget(Math.max(0, +String(e.target.value).replace(/\D/g, "") || 0))}
            className="w-14 text-right rounded-md px-1.5 py-0.5 pl-mono text-[11px]"
            style={{ border: `1px solid ${C.line}`, background: C.chalk, color: C.ink }} />
        </label>
      </div>

      <div className="flex items-baseline gap-2 mt-3">
        <span className="pl-display text-5xl font-bold leading-none" style={{ color: over ? C.z5 : C.ink }}>{total.toLocaleString()}</span>
        <span className="pl-mono text-xs" style={{ color: C.faint }}>/ {target.toLocaleString()} KCAL</span>
      </div>
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: C.chalk }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: over ? C.z5 : pct > 0.85 ? C.z3 : C.z2 }} />
      </div>

      <div className="mt-4 grid gap-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.chalk}` }}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{e.name}</div>
              <div className="pl-mono text-[11px]" style={{ color: C.smoke }}>{e.at} · P{e.p} C{e.c} F{e.f}</div>
            </div>
            <div className="pl-display text-lg font-bold shrink-0">{e.kcal.toLocaleString()}<span className="text-xs font-medium" style={{ color: C.faint }}> kcal</span></div>
            <button aria-label={`delete ${e.name}`} onClick={() => onDelete(e.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: C.faint }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-sm mt-1" style={{ color: C.smoke }}>Nothing logged yet — scan your next meal above.</p>
        )}
      </div>
    </section>
  );
}

/* ---------------- 7-day strip ---------------- */
function WeekStrip({ log, target }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = dayISO(i - 6);
    const total = (log[iso] || []).reduce((s, e) => s + e.kcal, 0);
    return { iso, total, label: new Date(iso + "T12:00:00").toLocaleDateString("en", { weekday: "narrow" }) };
  });
  const max = Math.max(target, ...days.map((d) => d.total), 1);
  return (
    <section className="rounded-3xl p-5 pl-fade" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <Eyebrow color={C.z1}>LAST 7 DAYS</Eyebrow>
      <div className="flex items-end gap-2 mt-4" style={{ height: 72 }}>
        {days.map((d, i) => (
          <div key={d.iso} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div className="w-full rounded-md pl-bar"
              style={{
                height: `${Math.max(4, (d.total / max) * 100)}%`,
                background: i === 6 ? C.z3 : d.total === 0 ? C.line : d.total > target && target > 0 ? C.z5 : C.z1,
                animationDelay: `${i * 50}ms`,
              }} />
            <span className="pl-mono text-[10px]" style={{ color: i === 6 ? C.ink : C.faint }}>{d.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- app ---------------- */
export default function App() {
  const [log, setLog] = useState(() => loadJSON(LOG_KEY, {}));
  const [target, setTargetState] = useState(() => loadJSON(TARGET_KEY, 2000));
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => saveJSON(LOG_KEY, log), [log]);
  const setTarget = (t) => { setTargetState(t); saveJSON(TARGET_KEY, t); };

  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const addEntry = (r) => {
    const today = dayISO();
    const entry = { id: String(Date.now()), name: r.dish, kcal: r.kcal, p: r.p, c: r.c, f: r.f, at: fmtTime() };
    setLog((l) => ({ ...l, [today]: [...(l[today] || []), entry] }));
    notify(`Logged "${r.dish}" — ${r.kcal.toLocaleString()} kcal.`);
  };

  const deleteEntry = (id) => {
    const today = dayISO();
    setLog((l) => ({ ...l, [today]: (l[today] || []).filter((e) => e.id !== id) }));
  };

  return (
    <div className="min-h-screen" style={{ background: C.chalk }}>
      <header className="sticky top-0 z-10 px-5 py-3.5 flex items-center justify-between" style={{ background: C.iron, color: "#fff" }}>
        <div className="flex items-center gap-2.5">
          <svg width="23" height="18" viewBox="0 0 26 20" aria-hidden="true">
            {[C.z1, C.z2, C.z3, C.z4, C.z5].map((c, i) => (
              <rect key={i} x={i * 5.2} y={20 - (8 + i * 3)} width="3.6" height={8 + i * 3} rx="1" fill={c} />
            ))}
          </svg>
          <span className="pl-display font-bold tracking-wide text-lg">PULSECOACH <span style={{ color: C.z3 }}>LENS</span></span>
        </div>
        <span className="pl-mono text-[11px] tracking-[.15em]" style={{ color: "rgba(255,255,255,.55)" }}>{fmtDate()}</span>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 grid gap-4 pb-14">
        <Scanner onLogged={addEntry} />
        <TodayLog log={log} target={target} setTarget={setTarget} onDelete={deleteEntry} />
        <WeekStrip log={log} target={target} />
        <p className="pl-mono text-center text-[10px] tracking-[.15em] mt-1" style={{ color: C.faint }}>
          ESTIMATES BY AI VISION · NOT MEDICAL ADVICE
        </p>
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 pl-fade flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: C.iron, color: "#fff", maxWidth: "92vw" }}>
          {toast}
          <button aria-label="dismiss" onClick={() => setToast(null)} style={{ color: C.faint }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
