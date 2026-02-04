export default async function handler(req, res) {
  // CORS so WordPress can call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Always respond with JSON (never crash)
    if (req.method !== "POST") {
      return res.status(200).json({ reply: "POST only", lead: {} });
    }

    // Parse body safely
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const page_url = typeof body.page_url === "string" ? body.page_url : "";

    // If key missing, show it clearly
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply: "Server setup error: OPENAI_API_KEY is missing in Vercel Environment Variables (Production).",
        lead: {},
      });
    }

    // If no messages, show greeting
    if (messages.length === 0) {
      return res.status(200).json({
        reply: "Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?",
        lead: {},
      });
    }

    const system =
      "You are the Pure Aura Cleaning Solutions website assistant. " +
      "Goal: capture qualified commercial cleaning leads. " +
      "Ask in order: facility type (office, medical, bank, property_management, other), city+zip, frequency, preferred time, size, name, phone, email, notes. " +
      "Do NOT collect sensitive medical/patient info. " +
      "If asked pricing: flat-rate proposal after walkthrough. " +
      'Return JSON only: {"reply":"...","lead":{...}}';

    // Call OpenAI (stable endpoint)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({
            role: String(m.role || "user"),
            content: String(m.content || ""),
          })),
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return res.status(200).json({ reply: `OpenAI error: ${msg}`, lead: {} });
    }

    const outText = data?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(outText);
    } catch {
      parsed = { reply: outText || "What city and ZIP is the facility in?", lead: {} };
    }

    const lead = parsed.lead || {};
    const hasMinimum =
      !!lead.name && !!lead.phone && !!lead.email &&
      !!lead.service_type && (!!lead.city || !!lead.zip);

    // Send to Google Sheets (never crash if webhook fails)
    if (hasMinimum && process.env.LEAD_WEBHOOK_URL) {
      try {
        await fetch(process.env.LEAD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...lead, page_url }),
        });
      } catch (e) {
        console.log("Webhook error:", String(e));
      }
    }

    return res.status(200).json({
      reply: parsed.reply || "What city and ZIP is the facility in?",
      lead,
    });
  } catch (err) {
    // If ANY crash happens, return it instead of failing the function
    return res.status(200).json({
      reply: `Server crash caught: ${String(err)}`,
      lead: {},
    });
  }
}

