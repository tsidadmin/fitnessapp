import Anthropic from "@anthropic-ai/sdk";

/* Medical report -> nutrition-relevant markers + tailored food guidance.
   Accepts a photo (jpeg/png/webp/gif) or a PDF of the report. */

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    is_medical_report: { type: "boolean", description: "true only if the document is a medical / health-screening / lab report" },
    summary: { type: "string", description: "3-4 plain-language sentences a layperson understands: overall picture and what matters most for their diet" },
    markers: {
      type: "array",
      description: "health markers found in the report that are relevant to nutrition, most important first, max 12",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "e.g. LDL cholesterol" },
          value: { type: "string", description: "value with unit as printed, e.g. 4.2 mmol/L" },
          status: { type: "string", enum: ["normal", "borderline", "high", "low"] },
          note: { type: "string", description: "one short sentence on what this means for food choices" },
        },
        required: ["name", "value", "status", "note"],
        additionalProperties: false,
      },
    },
    eat_more: {
      type: "array",
      description: "5-7 foods/food groups to eat more of, tailored to the markers",
      items: {
        type: "object",
        properties: { food: { type: "string" }, why: { type: "string", description: "one short sentence tied to their numbers" } },
        required: ["food", "why"],
        additionalProperties: false,
      },
    },
    limit: {
      type: "array",
      description: "4-6 foods/food groups to cut back on, tailored to the markers",
      items: {
        type: "object",
        properties: { food: { type: "string" }, why: { type: "string" } },
        required: ["food", "why"],
        additionalProperties: false,
      },
    },
    tips: { type: "array", items: { type: "string" }, description: "exactly 3 short practical eating-habit tips for this person" },
    see_doctor: { type: "boolean", description: "true if any value looks clearly abnormal and deserves a professional follow-up" },
  },
  required: ["is_medical_report", "summary", "markers", "eat_more", "limit", "tips", "see_doctor"],
  additionalProperties: false,
};

const PROMPT =
  "Read this health screening / lab report and act as a nutrition guide inside a fitness app. " +
  "Extract the markers most relevant to food choices (lipid panel, glucose/HbA1c, blood pressure, uric acid, " +
  "liver and kidney markers, iron, vitamins, etc.), judge each against the reference ranges printed on the report, " +
  "then give practical food recommendations tailored to those numbers (Singapore food context where helpful). " +
  "Be specific ('oats, barley and beans' not 'more fibre'). You are not a doctor: do not diagnose, keep guidance at " +
  "general-nutrition level, and set see_doctor true if anything clearly needs professional follow-up. " +
  "If the document is not a medical or health report, set is_medical_report false and leave lists empty.";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "server_not_configured" });

  const { file, media_type: mediaType } = req.body || {};
  if (!file || typeof file !== "string") return res.status(400).json({ error: "missing_file" });
  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.includes(mediaType)) return res.status(400).json({ error: "bad_file_type" });

  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: file } };

  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      output_config: { format: { type: "json_schema", schema: REPORT_SCHEMA } },
      messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
    });
    if (msg.stop_reason === "refusal") return res.status(200).json({ is_medical_report: false });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "bad_api_key" });
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "rate_limited" });
    console.error("analyze-report failed:", err?.status, err?.message);
    return res.status(502).json({ error: "analysis_failed" });
  }
}
