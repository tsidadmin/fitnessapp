/* Generates 10 fictional lab-report PDFs the PulseCoach Health scanner can read.
   All patient names, IDs and clinics are invented; values are illustrative only.
   Run: node sample-reports/generate.cjs  */
const fs = require("fs");
const path = require("path");

/* ---- tiny single-page PDF writer (Courier, so columns line up) ---- */
function makePdf(lines) {
  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let content = "BT /F1 10 Tf 40 800 Td 13.5 TL\n";
  for (const l of lines) content += `(${esc(l)}) Tj T*\n`;
  content += "ET";

  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += String(off).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

/* build the printable lines for one report */
function render(r) {
  const L = [];
  L.push(r.lab);
  L.push(r.addr);
  L.push("=".repeat(70));
  L.push(`Patient: ${r.name}`.padEnd(38) + `MRN: ${r.mrn}`);
  L.push(`Age/Sex: ${r.age} / ${r.sex}`.padEnd(38) + `Collected: ${r.date}`);
  L.push(`Referring: ${r.doctor}`.padEnd(38) + `Fasting: ${r.fasting}`);
  L.push("=".repeat(70));
  L.push("");
  for (const sec of r.sections) {
    L.push(sec.title);
    L.push("Test".padEnd(30) + "Result".padEnd(14) + "Ref. Range".padEnd(16) + "Flag");
    L.push("-".repeat(70));
    for (const [test, result, range, flag] of sec.rows) {
      L.push(test.padEnd(30) + result.padEnd(14) + range.padEnd(16) + (flag || ""));
    }
    L.push("");
  }
  if (r.comment) { L.push("Comment: " + r.comment); L.push(""); }
  L.push("-".repeat(70));
  L.push("Electronically verified. Fictional sample for app testing only.");
  L.push("Not a real medical document. Reference ranges vary by laboratory.");
  return L;
}

const reports = [
  {
    file: "01_healthy_all_normal.pdf",
    lab: "GREENVIEW HEALTH SCREENING CENTRE",
    addr: "12 Wellness Ave, #03-04, Singapore 049315   Tel 6555 0101",
    name: "Nur Aisyah Rahman", mrn: "GV-100241", age: "27", sex: "Female",
    doctor: "Dr Lim Wei Ming", date: "02 Jul 2026", fasting: "Yes (10h)",
    sections: [
      { title: "LIPID PANEL", rows: [
        ["Total Cholesterol", "4.4 mmol/L", "< 5.2", ""],
        ["LDL Cholesterol", "2.5 mmol/L", "< 3.4", ""],
        ["HDL Cholesterol", "1.7 mmol/L", "> 1.0", ""],
        ["Triglycerides", "0.9 mmol/L", "< 1.7", ""],
      ]},
      { title: "METABOLIC", rows: [
        ["Fasting Glucose", "4.9 mmol/L", "3.9 - 6.0", ""],
        ["HbA1c", "5.1 %", "< 5.7", ""],
      ]},
      { title: "OTHERS", rows: [
        ["Vitamin D (25-OH)", "42 ng/mL", "30 - 100", ""],
        ["Haemoglobin", "13.6 g/dL", "12.0 - 15.5", ""],
        ["Uric Acid", "290 umol/L", "150 - 350", ""],
      ]},
    ],
    comment: "All screened values within normal limits. Routine review in 12 months.",
  },
  {
    file: "02_high_cholesterol.pdf",
    lab: "CITYLAB DIAGNOSTICS",
    addr: "88 Raffles Quay, #12-01, Singapore 048583   Tel 6555 0202",
    name: "Daniel Ong Kok Heng", mrn: "CL-778120", age: "48", sex: "Male",
    doctor: "Dr Sarah Tan", date: "28 Jun 2026", fasting: "Yes (12h)",
    sections: [
      { title: "LIPID PANEL", rows: [
        ["Total Cholesterol", "6.7 mmol/L", "< 5.2", "HIGH"],
        ["LDL Cholesterol", "4.6 mmol/L", "< 3.4", "HIGH"],
        ["HDL Cholesterol", "0.9 mmol/L", "> 1.0", "LOW"],
        ["Triglycerides", "2.1 mmol/L", "< 1.7", "HIGH"],
        ["Chol/HDL Ratio", "7.4", "< 4.5", "HIGH"],
      ]},
      { title: "METABOLIC", rows: [
        ["Fasting Glucose", "5.4 mmol/L", "3.9 - 6.0", ""],
        ["HbA1c", "5.6 %", "< 5.7", ""],
      ]},
    ],
    comment: "Dyslipidaemia. Lifestyle and dietary modification advised; clinical correlation recommended.",
  },
  {
    file: "03_prediabetes.pdf",
    lab: "METROHEALTH LABORATORY",
    addr: "5 Science Park Dr, Singapore 118253   Tel 6555 0303",
    name: "Priya Nair", mrn: "MH-334519", age: "44", sex: "Female",
    doctor: "Dr Arjun Menon", date: "25 Jun 2026", fasting: "Yes (10h)",
    sections: [
      { title: "GLYCAEMIC CONTROL", rows: [
        ["Fasting Glucose", "6.4 mmol/L", "3.9 - 6.0", "HIGH"],
        ["HbA1c", "6.1 %", "< 5.7", "HIGH"],
        ["Fasting Insulin", "18 uIU/mL", "2.6 - 24.9", ""],
      ]},
      { title: "LIPID PANEL", rows: [
        ["Total Cholesterol", "5.5 mmol/L", "< 5.2", "HIGH"],
        ["LDL Cholesterol", "3.5 mmol/L", "< 3.4", "HIGH"],
        ["HDL Cholesterol", "1.1 mmol/L", "> 1.0", ""],
        ["Triglycerides", "1.9 mmol/L", "< 1.7", "HIGH"],
      ]},
    ],
    comment: "HbA1c in pre-diabetic range. Weight management and reduced refined-carbohydrate intake advised.",
  },
  {
    file: "04_iron_deficiency_anaemia.pdf",
    lab: "HARBOURFRONT MEDICAL LABS",
    addr: "1 Maritime Sq, #09-10, Singapore 099253   Tel 6555 0404",
    name: "Chloe Tan Hui Ling", mrn: "HF-560087", age: "31", sex: "Female",
    doctor: "Dr Rachel Koh", date: "01 Jul 2026", fasting: "No",
    sections: [
      { title: "FULL BLOOD COUNT", rows: [
        ["Haemoglobin", "10.2 g/dL", "12.0 - 15.5", "LOW"],
        ["MCV", "72 fL", "80 - 100", "LOW"],
        ["MCH", "23 pg", "27 - 33", "LOW"],
        ["Red Cell Count", "4.1 x10^12/L", "3.8 - 5.2", ""],
      ]},
      { title: "IRON STUDIES", rows: [
        ["Ferritin", "8 ug/L", "15 - 200", "LOW"],
        ["Serum Iron", "6 umol/L", "10 - 30", "LOW"],
        ["Transferrin Sat.", "9 %", "20 - 50", "LOW"],
      ]},
    ],
    comment: "Microcytic hypochromic picture consistent with iron deficiency. Dietary iron and clinical review advised.",
  },
  {
    file: "05_gout_high_uric_acid.pdf",
    lab: "EASTPOINT PATHOLOGY",
    addr: "3 Simei St 6, Singapore 528833   Tel 6555 0505",
    name: "Marcus Lee Zhi Wei", mrn: "EP-221904", age: "52", sex: "Male",
    doctor: "Dr Faizal Hamid", date: "20 Jun 2026", fasting: "Yes (10h)",
    sections: [
      { title: "METABOLIC / RENAL", rows: [
        ["Uric Acid", "512 umol/L", "200 - 430", "HIGH"],
        ["Creatinine", "98 umol/L", "60 - 110", ""],
        ["eGFR", "88 mL/min", "> 90", "LOW"],
      ]},
      { title: "LIPID PANEL", rows: [
        ["Total Cholesterol", "5.8 mmol/L", "< 5.2", "HIGH"],
        ["Triglycerides", "3.1 mmol/L", "< 1.7", "HIGH"],
        ["HDL Cholesterol", "0.95 mmol/L", "> 1.0", "LOW"],
      ]},
      { title: "GLYCAEMIC", rows: [
        ["Fasting Glucose", "5.8 mmol/L", "3.9 - 6.0", ""],
        ["HbA1c", "5.6 %", "< 5.7", ""],
      ]},
    ],
    comment: "Hyperuricaemia with raised triglycerides. Purine-aware diet and alcohol reduction advised.",
  },
  {
    file: "06_vitamin_deficiency.pdf",
    lab: "NORTHGATE WELLNESS LAB",
    addr: "20 Woodlands Ave 9, Singapore 738957   Tel 6555 0606",
    name: "Samuel Wong Jia Jun", mrn: "NG-908771", age: "35", sex: "Male",
    doctor: "Dr Nadia Ismail", date: "30 Jun 2026", fasting: "Yes (8h)",
    sections: [
      { title: "VITAMINS & MINERALS", rows: [
        ["Vitamin D (25-OH)", "14 ng/mL", "30 - 100", "LOW"],
        ["Vitamin B12", "165 pg/mL", "200 - 900", "LOW"],
        ["Folate", "3.1 ng/mL", "3.0 - 20.0", ""],
        ["Serum Calcium", "2.18 mmol/L", "2.20 - 2.60", "LOW"],
        ["Magnesium", "0.72 mmol/L", "0.70 - 1.00", ""],
      ]},
      { title: "GENERAL", rows: [
        ["Haemoglobin", "13.1 g/dL", "13.0 - 17.0", ""],
        ["Fasting Glucose", "5.0 mmol/L", "3.9 - 6.0", ""],
      ]},
    ],
    comment: "Vitamin D and B12 insufficiency. Dietary sources and sunlight exposure advised; recheck in 3 months.",
  },
  {
    file: "07_fatty_liver.pdf",
    lab: "RIVERSIDE CLINICAL LABORATORY",
    addr: "30 Merchant Rd, #02-15, Singapore 058282   Tel 6555 0707",
    name: "Kenneth Chua Boon Teck", mrn: "RS-445612", age: "46", sex: "Male",
    doctor: "Dr Michelle Ang", date: "22 Jun 2026", fasting: "Yes (12h)",
    sections: [
      { title: "LIVER FUNCTION", rows: [
        ["ALT (SGPT)", "78 U/L", "10 - 40", "HIGH"],
        ["AST (SGOT)", "55 U/L", "10 - 40", "HIGH"],
        ["GGT", "96 U/L", "10 - 60", "HIGH"],
        ["Bilirubin (Total)", "14 umol/L", "5 - 21", ""],
      ]},
      { title: "METABOLIC", rows: [
        ["Triglycerides", "2.8 mmol/L", "< 1.7", "HIGH"],
        ["Fasting Glucose", "6.1 mmol/L", "3.9 - 6.0", "HIGH"],
        ["HbA1c", "5.9 %", "< 5.7", "HIGH"],
        ["BMI (on file)", "29.4 kg/m2", "18.5 - 24.9", "HIGH"],
      ]},
    ],
    comment: "Transaminitis with metabolic features, suggestive of fatty liver. Weight loss and reduced sugar/alcohol advised.",
  },
  {
    file: "08_kidney_markers.pdf",
    lab: "SUMMIT RENAL & METABOLIC LAB",
    addr: "11 Jln Tan Tock Seng, Singapore 308433   Tel 6555 0808",
    name: "Grace Sim Mei Fen", mrn: "SM-671203", age: "59", sex: "Female",
    doctor: "Dr Harpreet Singh", date: "18 Jun 2026", fasting: "Yes (10h)",
    sections: [
      { title: "RENAL PANEL", rows: [
        ["Creatinine", "138 umol/L", "45 - 90", "HIGH"],
        ["eGFR", "42 mL/min", "> 90", "LOW"],
        ["Urea", "9.8 mmol/L", "2.8 - 7.2", "HIGH"],
        ["Potassium", "5.4 mmol/L", "3.5 - 5.1", "HIGH"],
        ["Phosphate", "1.6 mmol/L", "0.8 - 1.5", "HIGH"],
        ["Sodium", "139 mmol/L", "135 - 145", ""],
      ]},
      { title: "OTHERS", rows: [
        ["Haemoglobin", "11.0 g/dL", "12.0 - 15.5", "LOW"],
        ["Uric Acid", "455 umol/L", "150 - 350", "HIGH"],
      ]},
    ],
    comment: "Reduced eGFR with electrolyte changes. Potassium/phosphate-aware diet and nephrology review advised.",
  },
  {
    file: "09_hypertension_screen.pdf",
    lab: "PARKWAY COMMUNITY HEALTH LAB",
    addr: "6 Napier Rd, #01-02, Singapore 258499   Tel 6555 0909",
    name: "Ravi Kumar", mrn: "PW-512668", age: "55", sex: "Male",
    doctor: "Dr Cheryl Ng", date: "15 Jun 2026", fasting: "Yes (10h)",
    sections: [
      { title: "VITALS (CLINIC)", rows: [
        ["Blood Pressure", "152/96 mmHg", "< 130/80", "HIGH"],
        ["Resting Heart Rate", "82 bpm", "60 - 100", ""],
      ]},
      { title: "ELECTROLYTES", rows: [
        ["Sodium", "146 mmol/L", "135 - 145", "HIGH"],
        ["Potassium", "3.9 mmol/L", "3.5 - 5.1", ""],
      ]},
      { title: "LIPID PANEL", rows: [
        ["Total Cholesterol", "5.6 mmol/L", "< 5.2", "HIGH"],
        ["LDL Cholesterol", "3.6 mmol/L", "< 3.4", "HIGH"],
        ["Triglycerides", "1.8 mmol/L", "< 1.7", "HIGH"],
      ]},
    ],
    comment: "Stage-2 hypertension with borderline lipids. Sodium reduction (DASH-style diet) advised; clinical review.",
  },
  {
    file: "10_full_annual_screening.pdf",
    lab: "ONE HEALTH EXECUTIVE SCREENING",
    addr: "50 Collyer Quay, #15-01, Singapore 049321   Tel 6555 1010",
    name: "Angeline Teo Shu Hui", mrn: "OH-330549", age: "41", sex: "Female",
    doctor: "Dr Benjamin Lau", date: "05 Jul 2026", fasting: "Yes (12h)",
    sections: [
      { title: "LIPID PANEL", rows: [
        ["Total Cholesterol", "5.9 mmol/L", "< 5.2", "HIGH"],
        ["LDL Cholesterol", "3.8 mmol/L", "< 3.4", "HIGH"],
        ["HDL Cholesterol", "1.4 mmol/L", "> 1.0", ""],
        ["Triglycerides", "1.5 mmol/L", "< 1.7", ""],
      ]},
      { title: "GLYCAEMIC", rows: [
        ["Fasting Glucose", "5.7 mmol/L", "3.9 - 6.0", ""],
        ["HbA1c", "5.8 %", "< 5.7", "HIGH"],
      ]},
      { title: "LIVER & RENAL", rows: [
        ["ALT (SGPT)", "34 U/L", "10 - 40", ""],
        ["Creatinine", "68 umol/L", "45 - 90", ""],
        ["Uric Acid", "338 umol/L", "150 - 350", ""],
      ]},
      { title: "HAEMATOLOGY & VITAMINS", rows: [
        ["Haemoglobin", "11.8 g/dL", "12.0 - 15.5", "LOW"],
        ["Ferritin", "13 ug/L", "15 - 200", "LOW"],
        ["Vitamin D (25-OH)", "22 ng/mL", "30 - 100", "LOW"],
      ]},
    ],
    comment: "Mixed picture: borderline lipids/glycaemia with mild iron and vitamin D insufficiency. Dietary optimisation advised.",
  },
];

const outDir = __dirname;
for (const r of reports) {
  fs.writeFileSync(path.join(outDir, r.file), makePdf(render(r)));
  console.log("wrote", r.file);
}
console.log("Done -", reports.length, "reports in", outDir);
