# Sample medical reports (for testing the Health scanner)

Ten fictional lab-report PDFs to demo the app's **Health → Upload a medical report** feature.
Open the app, go to the **HEALTH** tab, and upload any of these (drag-drop or file picker).

> ⚠️ **All fictional.** Invented patients, clinics, MRNs and values — for app testing only.
> Not real medical documents and not medical advice.

| File | Clinical picture it demonstrates |
|------|----------------------------------|
| `01_healthy_all_normal.pdf` | Everything in range — the "all clear" path |
| `02_high_cholesterol.pdf` | Dyslipidaemia — high LDL/total cholesterol, low HDL |
| `03_prediabetes.pdf` | Raised fasting glucose + HbA1c (pre-diabetic range) |
| `04_iron_deficiency_anaemia.pdf` | Low haemoglobin, ferritin & iron studies |
| `05_gout_high_uric_acid.pdf` | High uric acid + triglycerides |
| `06_vitamin_deficiency.pdf` | Low vitamin D, B12 and calcium |
| `07_fatty_liver.pdf` | Elevated ALT/AST/GGT with metabolic markers |
| `08_kidney_markers.pdf` | Reduced eGFR, high creatinine/potassium/phosphate |
| `09_hypertension_screen.pdf` | High blood pressure, sodium and borderline lipids |
| `10_full_annual_screening.pdf` | Mixed full-panel screening (several mild flags) |

## Regenerating

```
node sample-reports/generate.cjs
```

Edit `generate.cjs` to change values, add markers, or create new reports.
