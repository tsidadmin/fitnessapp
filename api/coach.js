import Anthropic from "@anthropic-ai/sdk";

/* One endpoint for the app's text AI: weekly plan, food text estimate, coach chat. */

const MODEL = "claude-opus-4-8";

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "max 28 words" },
    week: {
      type: "array",
      description: "exactly 7 entries, Mon through Sun",
      items: {
        type: "object",
        properties: {
          day: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
          focus: { type: "string", description: "short session title; use 'Recovery' for rest days" },
          work: {
            type: "array",
            items: {
              type: "object",
              properties: { n: { type: "string" }, d: { type: "string", description: "sets x reps or duration" } },
              required: ["n", "d"],
              additionalProperties: false,
            },
          },
        },
        required: ["day", "focus", "work"],
        additionalProperties: false,
      },
    },
    tips: { type: "array", items: { type: "string" }, description: "exactly 3 short coaching tips" },
  },
  required: ["summary", "week", "tips"],
  additionalProperties: false,
};

const FOOD_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "short cleaned dish name, max 48 chars" },
    kcal: { type: "integer" },
    protein: { type: "integer" },
    carbs: { type: "integer" },
    fat: { type: "integer" },
  },
  required: ["name", "kcal", "protein", "carbs", "fat"],
  additionalProperties: false,
};

const str = (v, max) => String(v ?? "").slice(0, max);
const int = (v) => Math.round(+v) || 0;

async function structured(client, prompt, schema, maxTokens) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(msg.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "server_not_configured" });

  const body = req.body || {};
  const client = new Anthropic();

  try {
    if (body.kind === "plan") {
      const p = body.profile || {}, t = body.targets || {};
      const prompt = `You are a certified fitness coach. Create a 1-week training plan.
Client: ${int(p.age)}yo ${str(p.sex, 6)}, ${int(p.height)}cm, ${int(p.weight)}kg. Goal: ${str(p.goal, 12)}. Trains ${int(p.days)} days/week. Activity: ${str(p.activity, 12)}.
Daily targets: ${int(t.kcal)} kcal, ${int(t.protein)}g protein, ${int(t.carbs)}g carbs, ${int(t.fat)}g fat.
Rules: week has exactly 7 entries Mon-Sun; exactly ${int(p.days)} training days, the rest have focus "Recovery" with 1-2 light items; 3-4 work items on training days; keep every string short; exactly 3 tips.`;
      const plan = await structured(client, prompt, PLAN_SCHEMA, 3000);
      if (!Array.isArray(plan.week) || plan.week.length !== 7) throw new Error("bad_shape");
      return res.status(200).json(plan);
    }

    if (body.kind === "food") {
      const desc = str(body.desc, 200).trim();
      if (!desc) return res.status(400).json({ error: "missing_desc" });
      const prompt = `Estimate nutrition for this ${str(body.meal, 12) || "meal"} entry: "${desc}" (Singapore context if ambiguous). Estimate for a typical single portion.`;
      const food = await structured(client, prompt, FOOD_SCHEMA, 500);
      return res.status(200).json(food);
    }

    if (body.kind === "chat") {
      const ctx = body.context || {};
      const history = (Array.isArray(body.messages) ? body.messages : [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-12)
        .map((m) => ({ role: m.role, content: str(m.content, 2000) }));
      if (!history.length || history[history.length - 1].role !== "user") {
        return res.status(400).json({ error: "missing_message" });
      }
      const system = `You are PulseCoach, a friendly, direct fitness coach inside a mobile app.
Client: ${str(ctx.name, 40)}, ${int(ctx.age)}yo ${str(ctx.sex, 6)}, ${int(ctx.height)}cm, ${int(ctx.weight)}kg. Goal: ${str(ctx.goal, 12)} (${int(ctx.days)} training days/week).
Daily targets: ${int(ctx.kcal)} kcal, ${int(ctx.protein)}g protein. Today so far: ${int(ctx.eaten)} kcal, ${int(ctx.eatenProtein)}g protein, ${int(ctx.workouts)} workout(s) logged. Today's planned session: ${str(ctx.focus, 60) || "no plan yet"}.
Rules: be specific to this client's numbers; keep replies under 110 words; plain text only, no markdown headers; encouraging but honest; you are not a doctor — for pain, injury or medical issues, advise seeing a professional.`;
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system,
        messages: history,
      });
      const reply = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return res.status(200).json({ reply });
    }

    return res.status(400).json({ error: "bad_kind" });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "bad_api_key" });
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "rate_limited" });
    console.error("coach failed:", body.kind, err?.status, err?.message);
    return res.status(502).json({ error: "coach_failed" });
  }
}
