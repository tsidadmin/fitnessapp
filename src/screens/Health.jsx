import React, { useRef, useState } from "react";
import { FileText, HeartPulse, Loader2, RotateCcw, Stethoscope, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { C } from "../theme.js";
import { Btn, Card, Eyebrow } from "../ui.jsx";
import { apiAnalyzeReport, reportFileToBase64 } from "../lib.js";

const AMBER = "#F59E0B";
const STATUS = {
  normal: { color: C.z2, label: "NORMAL" },
  borderline: { color: AMBER, label: "BORDERLINE" },
  high: { color: C.z5, label: "HIGH" },
  low: { color: C.z1, label: "LOW" },
};

const ERROR_COPY = {
  server_not_configured: "The analyser isn't wired to an AI key yet — add ANTHROPIC_API_KEY in Vercel.",
  rate_limited: "The AI is catching its breath — try again in a few seconds.",
  not_report: "That doesn't look like a medical report. Try a clear photo or PDF of a lab / health-screening report.",
  pdf_too_large: "That PDF is over 3 MB. Export a smaller one, or snap photos of the key pages instead.",
  bad_file: "Couldn't read that file. Try a JPEG, PNG or PDF.",
  analysis_failed: "Analysis failed. Check your connection and try again.",
};

export default function Health({ state, mutate, notify }) {
  const [phase, setPhase] = useState(state.health ? "result" : "idle"); // idle | busy | result | error
  const [errKey, setErrKey] = useState("analysis_failed");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const health = state.health;

  const handleFile = async (file) => {
    if (!file || phase === "busy") return;
    setPhase("busy");
    try {
      const { base64, mediaType } = await reportFileToBase64(file);
      const data = await apiAnalyzeReport(base64, mediaType);
      if (!data.is_medical_report) { setErrKey("not_report"); setPhase("error"); return; }
      const parsed = {
        at: new Date().toISOString().slice(0, 10),
        summary: String(data.summary || ""),
        markers: (Array.isArray(data.markers) ? data.markers : []).slice(0, 12),
        eatMore: (Array.isArray(data.eat_more) ? data.eat_more : []).slice(0, 8),
        limit: (Array.isArray(data.limit) ? data.limit : []).slice(0, 8),
        tips: (Array.isArray(data.tips) ? data.tips : []).slice(0, 3),
        seeDoctor: !!data.see_doctor,
      };
      mutate((s) => ({ ...s, health: parsed }));
      notify("Report analysed — your coach now knows these numbers too.");
      setPhase("result");
    } catch (e) {
      setErrKey(ERROR_COPY[e.message] ? e.message : "analysis_failed");
      setPhase("error");
    }
  };

  const removeData = () => {
    mutate((s) => ({ ...s, health: null }));
    setPhase("idle");
    notify("Report data removed from this device.");
  };

  const Uploader = ({ compact }) => (
    <button
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer?.files?.[0]); }}
      className={`relative w-full flex flex-col items-center justify-center gap-2 ${compact ? "py-5" : "py-9"}`}
      style={{
        border: `1px dashed ${drag ? C.z3 : "rgba(255,255,255,.3)"}`,
        background: drag ? "rgba(79,195,247,.12)" : "rgba(255,255,255,.04)",
      }}>
      <i className="plc tl" /><i className="plc tr" /><i className="plc bl" /><i className="plc br" />
      <span className="p-3.5" style={{ background: C.z4, boxShadow: `0 3px 0 0 ${C.z3}` }}><FileText size={22} color="#fff" /></span>
      <span className="font-semibold text-sm">Upload a medical report</span>
      <span className="pl-mono text-[11px] tracking-wider" style={{ color: "rgba(255,255,255,.4)" }}>PHOTO OR PDF · BLOOD PANEL · SCREENING</span>
    </button>
  );

  return (
    <div className="grid gap-3 pl-fade">
      {phase !== "result" && (
        <section className="p-5 pl-grid-bg" style={{ backgroundColor: C.iron, color: "#fff", boxShadow: "0 16px 40px rgba(0,2,103,.18)" }}>
          <div className="pl-mono flex items-center gap-2 text-[11px] font-medium tracking-[.18em]" style={{ color: "rgba(255,255,255,.45)" }}>
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: C.z3 }} />
            HEALTH REPORT · AI ANALYSIS
          </div>

          {phase === "idle" && (
            <div className="pl-fade">
              <h2 className="pl-display text-3xl font-extrabold mt-3 leading-tight">
                Food advice from <span className="pl-serif font-semibold" style={{ color: C.z3 }}>your bloodwork</span>.
              </h2>
              <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,.55)" }}>
                Upload a health screening or lab report. The coach reads your markers and turns
                them into practical eat-more / go-easy-on food lists.
              </p>
              <div className="mt-4"><Uploader /></div>
              <p className="pl-mono text-[10px] tracking-wider mt-3" style={{ color: "rgba(255,255,255,.35)" }}>
                ANALYSED BY AI · STORED ONLY ON THIS DEVICE · NOT MEDICAL ADVICE
              </p>
            </div>
          )}

          {phase === "busy" && (
            <div className="mt-4 pl-fade">
              <div className="relative overflow-hidden flex items-center justify-center" style={{ height: 160, border: "1px solid rgba(79,195,247,.35)", background: "rgba(255,255,255,.04)" }}>
                <Stethoscope size={30} style={{ color: C.z3, opacity: .7 }} />
                <div className="pl-scanline" />
              </div>
              <div className="pl-mono text-xs tracking-[.18em] mt-3 pl-pulse" style={{ color: C.z3 }}>READING YOUR REPORT…</div>
            </div>
          )}

          {phase === "error" && (
            <div className="mt-4 pl-fade">
              <div className="px-4 py-3 text-sm" style={{ background: "rgba(196,69,54,.15)", border: `1px solid ${C.z5}`, color: "#F3C3BC" }}>
                {ERROR_COPY[errKey]}
              </div>
              <button onClick={() => setPhase(health ? "result" : "idle")} className="mt-3 px-4 py-2.5 font-bold inline-flex items-center gap-2 text-sm" style={{ border: "1px solid rgba(255,255,255,.3)" }}>
                <RotateCcw size={15} /> {health ? "Back to my results" : "Try again"}
              </button>
            </div>
          )}
        </section>
      )}

      {phase === "result" && health && (
        <>
          <Card style={{ backgroundColor: C.iron, borderColor: C.iron, color: "#fff" }}>
            <div className="flex items-center justify-between">
              <div className="pl-mono text-[11px] tracking-[.18em]" style={{ color: C.z3 }}>REPORT SUMMARY · {health.at}</div>
              <HeartPulse size={16} style={{ color: C.z3 }} />
            </div>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#D5DCF5" }}>{health.summary}</p>
            {health.seeDoctor && (
              <div className="mt-3 px-3 py-2 text-xs font-semibold" style={{ background: "rgba(229,72,77,.18)", border: `1px solid ${C.z5}`, color: "#F5B8BB" }}>
                Some values deserve a professional look — please discuss this report with your doctor.
              </div>
            )}
          </Card>

          <Card>
            <Eyebrow zone="z1">YOUR MARKERS</Eyebrow>
            <div className="mt-2 grid">
              {health.markers.map((m, i) => {
                const st = STATUS[m.status] || STATUS.normal;
                return (
                  <div key={i} className="py-2.5" style={{ borderBottom: i < health.markers.length - 1 ? `1px solid ${C.chalk}` : "none" }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm flex-1">{m.name}</span>
                      <span className="pl-mono text-xs" style={{ color: C.smoke }}>{m.value}</span>
                      <span className="pl-mono text-[10px] font-semibold px-1.5 py-0.5" style={{ background: st.color, color: "#fff" }}>{st.label}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: C.smoke }}>{m.note}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ borderLeft: `3px solid ${C.z2}` }}>
            <div className="flex items-center gap-2">
              <TrendingUp size={15} style={{ color: C.z2 }} />
              <Eyebrow zone="z2">EAT MORE OF</Eyebrow>
            </div>
            <div className="mt-2 grid gap-2">
              {health.eatMore.map((x, i) => (
                <div key={i} className="text-sm leading-relaxed">
                  <span className="font-semibold">{x.food}</span>
                  <span style={{ color: C.smoke }}> — {x.why}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ borderLeft: `3px solid ${C.z5}` }}>
            <div className="flex items-center gap-2">
              <TrendingDown size={15} style={{ color: C.z5 }} />
              <Eyebrow zone="z5">GO EASY ON</Eyebrow>
            </div>
            <div className="mt-2 grid gap-2">
              {health.limit.map((x, i) => (
                <div key={i} className="text-sm leading-relaxed">
                  <span className="font-semibold">{x.food}</span>
                  <span style={{ color: C.smoke }}> — {x.why}</span>
                </div>
              ))}
            </div>
          </Card>

          {health.tips.length > 0 && (
            <Card>
              <Eyebrow zone="z3">HABITS THAT HELP</Eyebrow>
              <div className="mt-2 grid gap-2">
                {health.tips.map((t, i) => (
                  <div key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="pl-display font-bold" style={{ color: C.z3 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex gap-2">
            <Btn zone="z4" small onClick={() => setPhase("idle")}><FileText size={15} /> Analyse another report</Btn>
            <Btn kind="ghost" small onClick={removeData}><Trash2 size={15} /> Remove data</Btn>
          </div>
          <p className="pl-mono text-center text-[10px] tracking-[.15em]" style={{ color: C.faint }}>
            GENERAL NUTRITION GUIDANCE · NOT MEDICAL ADVICE · CONSULT YOUR DOCTOR
          </p>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
