export default async function handler(req, res) {
  // ✅ Allow your WordPress site to call this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ reply: "This endpoint expects a chat message.", lead: {} });
    }

    const { messages = [], page_url = "" } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: "Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?", lead: {} });
    }

    const system = `
You are the Pure Aura Cleaning Solutions website assistant.
Primary goal: capture qualified commercial cleaning leads.

Start by asking facility type in this order:
office, medical, bank, property_management, other.

Then collect, in order:
city + zip, frequency, preferred cleaning time, size bucket, name, phone, email, notes (optional).

Do NOT ask for sensitive medical/patient info.
If asked for pricing, say pricing follows a walkthrough and a flat-rate proposal within 24 hours.

Return JSON only:
{ "reply": "...", "lead": { ... } }
`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "system", content: system }, ...messages],
        response_format: { type: "json_object" },
      }),
    });

    const data = await r.json();

   // 🔍 TEMP: show OpenAI error message so we can diagnose
if (!r.ok) {
  console.log("OpenAI error:", data);

  const errorMessage =
    data?.error?.message ||
    data?.message ||
    JSON.stringify(data);

  return res.status(200).json({
    reply: `OpenAI setup error: ${errorMessage}`,
    lead: {},
  });
}

      });
    }

    const text = data.output?.[0]?.content?.[0]?.text || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { reply: "What city and ZIP is the facility in?", lead: {} };
    }

    const lead = parsed.lead || {};
    const hasMinimum =
      !!lead.name && !!lead.phone && !!lead.email &&
      !!lead.service_type && (!!lead.city || !!lead.zip);

    if (hasMinimum && process.env.LEAD_WEBHOOK_URL) {
      await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, page_url }),
      });
    }

    return res.status(200).json({
      reply: parsed.reply || "What city and ZIP is the facility in?",
      lead,
    });
  } catch (err) {
    return res.status(200).json({
      reply: "Quick setup issue on our end. Please call 740-284-8500 or email management@pureauracleaningsolutions.com and we’ll help right away.",
      lead: {},
    });
  }
}
