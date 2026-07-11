import Anthropic from "@anthropic-ai/sdk";

/* Structured-output schema: guarantees valid JSON back from the model.
   When the user has a health report on file, extra "verdict" fields are added
   so the model rates the meal against their markers. */
function foodSchema(withVerdict) {
  const props = {
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
  };
  const required = ["is_food", "dish", "kcal", "protein", "carbs", "fat", "items", "note"];

  if (withVerdict) {
    props.verdict = {
      type: "string",
      enum: ["good", "moderate", "limit"],
      description: "how well this meal fits THIS person's health markers: good = supports them, moderate = okay in moderation, limit = works against their markers",
    };
    props.verdict_reason = {
      type: "string",
      description: "1-2 short sentences explaining the verdict, referencing their specific markers (e.g. 'The fried skin adds saturated fat, which pushes your already-high LDL up.'). Empty string if no food.",
    };
    props.better_swap = {
      type: "string",
      description: "one concrete, tastier-or-similar swap or tweak that would help their markers (e.g. 'Ask for steamed instead of fried, and swap to half brown rice.'). Empty string if the meal is already a good fit.",
    };
    required.push("verdict", "verdict_reason", "better_swap");
  }
  return { type: "object", properties: props, required, additionalProperties: false };
}

const BASE_PROMPT =
  "Identify the food and/or drink in this photo and estimate nutrition for the visible portion size " +
  "(assume Singapore hawker/home portions if ambiguous). If several items are visible, list each in items " +
  "and make dish a combined name. If the photo contains no food or drink, set is_food to false and leave " +
  "the other fields at sensible zero/empty values.";

const verdictPrompt = (flags) =>
  BASE_PROMPT +
  `\n\nThis person's recent health report shows these out-of-range markers: ${flags}. ` +
  "Also judge how well THIS meal fits those markers: set verdict (good | moderate | limit), give a short " +
  "verdict_reason tied to their specific numbers, and offer one concrete better_swap when it would help " +
  "(leave better_swap empty if the meal is already a good fit). Be practical and non-alarming; you are not a doctor.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "server_not_configured" });
  }

  const { image, media_type: mediaType = "image/jpeg", health } = req.body || {};
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "missing_image" });
  }

  const flags = typeof health === "string" ? health.trim().slice(0, 300) : "";
  const withVerdict = flags.length > 0;

  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      output_config: { format: { type: "json_schema", schema: foodSchema(withVerdict) } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: withVerdict ? verdictPrompt(flags) : BASE_PROMPT },
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
