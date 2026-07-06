import Anthropic from "@anthropic-ai/sdk";

/* Structured-output schema: guarantees valid JSON back from the model. */
const FOOD_SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean", description: "true only if the photo shows food or drink" },
    dish: { type: "string", description: "short dish name, max 40 chars; combine multiple items like 'Chicken rice + iced tea'" },
    kcal: { type: "integer", description: "total estimated calories for the visible portion" },
    protein: { type: "integer", description: "grams" },
    carbs: { type: "integer", description: "grams" },
    fat: { type: "integer", description: "grams" },
    items: {
      type: "array",
      description: "per-item breakdown when several foods are visible; single entry otherwise",
      items: {
        type: "object",
        properties: { name: { type: "string" }, kcal: { type: "integer" } },
        required: ["name", "kcal"],
        additionalProperties: false,
      },
    },
    note: { type: "string", description: "one short sentence stating the portion assumption made" },
  },
  required: ["is_food", "dish", "kcal", "protein", "carbs", "fat", "items", "note"],
  additionalProperties: false,
};

const PROMPT =
  "Identify the food and/or drink in this photo and estimate nutrition for the visible portion size " +
  "(assume Singapore hawker/home portions if ambiguous). If several items are visible, list each in items " +
  "and make dish a combined name. If the photo contains no food or drink, set is_food to false and leave " +
  "the other fields at sensible zero/empty values.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "server_not_configured" });
  }

  const { image, media_type: mediaType = "image/jpeg" } = req.body || {};
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "missing_image" });
  }

  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      output_config: { format: { type: "json_schema", schema: FOOD_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    if (msg.stop_reason === "refusal") {
      return res.status(200).json({ is_food: false });
    }
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ error: "bad_api_key" });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "rate_limited" });
    }
    console.error("analyze-food failed:", err?.status, err?.message);
    return res.status(502).json({ error: "analysis_failed" });
  }
}
