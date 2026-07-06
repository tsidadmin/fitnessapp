import React, { useEffect, useState } from "react";
import { C, ZONE_TAG } from "./theme.js";

export const Eyebrow = ({ zone, children }) => (
  <div className="pl-mono flex items-center gap-2 text-[11px] font-medium tracking-[.15em]" style={{ color: C.smoke }}>
    {zone && <span className="inline-block w-2 h-2 rounded-sm" style={{ background: C[zone] }} />}
    {zone && <span style={{ color: C[zone] }}>{ZONE_TAG[zone]}</span>}
    {zone && <span style={{ color: C.line }}>—</span>}
    <span>{children}</span>
  </div>
);

export const ZoneMark = ({ h = 18 }) => (
  <svg width={h * 1.3} height={h} viewBox="0 0 26 20" aria-hidden="true">
    {[C.z1, C.z2, C.z3, C.z4, C.z5].map((c, i) => (
      <rect key={i} x={i * 5.2} y={20 - (8 + i * 3)} width="3.6" height={8 + i * 3} rx="1" fill={c} />
    ))}
  </svg>
);

export const Card = ({ children, className = "", style = {} }) => (
  <section className={"border p-5 " + className}
    style={{ background: C.card, borderColor: C.line, boxShadow: "0 16px 40px rgba(0,2,103,.05)", ...style }}>
    {children}
  </section>
);

export const Ring = ({ pct, color, size = 116, label, sub }) => {
  const r = (size - 14) / 2, circ = 2 * Math.PI * r;
  const clamped = Math.min(pct, 1);
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped)}
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="pl-display font-bold leading-none" style={{ fontSize: size * 0.26 }}>{label}</div>
        <div className="pl-mono text-[10px] mt-1" style={{ color: C.smoke }}>{sub}</div>
      </div>
    </div>
  );
};

export const MacroBar = ({ name, val, max, zone }) => {
  const pct = Math.min(100, Math.round((val / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="pl-mono text-[11px] tracking-wider" style={{ color: C.smoke }}>{name}</span>
        <span className="pl-display text-base font-semibold">{val}<span className="text-xs font-medium" style={{ color: C.faint }}> / {max} g</span></span>
      </div>
      <div className="h-2 rounded-full mt-1" style={{ background: C.chalk }}>
        <div className="h-2 rounded-full" style={{ width: pct + "%", background: C[zone], transition: "width .5s ease" }} />
      </div>
    </div>
  );
};

export const Btn = ({ children, onClick, kind = "solid", zone = null, disabled, className = "", small, ...rest }) => {
  const base = small ? "px-3 py-2 text-sm" : "px-4 py-3";
  // signature look: hard offset shadow — cyan under the violet primary, navy-tint elsewhere
  const hard = !zone || zone === "z4" ? `0 3px 0 0 ${C.z3}` : "0 3px 0 0 rgba(2,4,59,.22)";
  const styles = kind === "solid"
    ? { background: zone ? C[zone] : C.iron, color: "#fff", boxShadow: disabled ? "none" : hard }
    : kind === "ghost"
      ? { background: "transparent", color: C.ink, border: `1px solid ${C.faint}` }
      : { background: C.chalk, color: C.ink };
  return (
    <button {...rest} onClick={onClick} disabled={disabled}
      className={`${base} font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 ${className}`}
      style={styles}>
      {children}
    </button>
  );
};

export const Scale5 = ({ value, onChange, zone = "z1" }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3, 4, 5].map((v) => (
      <button key={v} onClick={() => onChange(v)} aria-label={"score " + v}
        className="flex-1 py-2 rounded-lg pl-display text-lg font-semibold border"
        style={{ background: value === v ? C[zone] : C.card, color: value === v ? "#fff" : C.smoke, borderColor: value === v ? C[zone] : C.line }}>
        {v}
      </button>
    ))}
  </div>
);

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="pl-mono text-[11px] tracking-wider" style={{ color: C.smoke }}>{label}</span>
    <div className="mt-1.5">{children}</div>
  </label>
);

export const Input = (props) => (
  <input {...props} className={"w-full rounded px-3.5 py-3 text-base " + (props.className || "")}
    style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink }} />
);

export function useCountUp(target, ms = 800) {
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
