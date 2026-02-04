export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { messages = [], page_url = "" } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages" });
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

Once you have: name + phone + email + service_type + (city or zip),
offer booking AFTER info is collected.

Return JSON only:
{ "reply": "...", "lead": { ... } }
`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "system", content: system }, ...messages],
        response_format: { type: "json_object" },
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data });

    const text = data.output?.[0]?.content?.[0]?.text || "{}";
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = { reply: "Thanks—what city and ZIP is the facility in?", lead: {} }; }

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

    return res.status(200).json({ reply: parsed.reply || "Thanks!", lead });

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
