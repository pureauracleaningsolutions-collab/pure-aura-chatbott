export default async function handler(req, res) {
  // ✅ CORS so WordPress can call this endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return res.status(200).json({ reply: "POST only", lead: {} });
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const page_url = typeof body.page_url === "string" ? body.page_url : "";

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply:
          "Server setup error: OPENAI_API_KEY is missing in Vercel Environment Variables (Production).",
        lead: {},
      });
    }

    // Greeting if no messages
    if (messages.length === 0) {
      return res.status(200).json({
        reply:
          "Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?",
        lead: {},
      });
    }

    const bookingLink = "https://pureaura-15xolc7fkt.live-website.com/book-now/";

    const system = `
You are the Pure Aura Cleaning Solutions website assistant.
Primary goal: capture qualified commercial cleaning leads and book a walkthrough.

Ask in this order:
1) Facility type (Office, Medical Office, Bank, Property Management, Other)
2) City + ZIP
3) Frequency (one-time, weekly, 2–3x/week, nightly, monthly)
4) Preferred cleaning window (after-hours/daytime/weekends)
5) Size estimate (sq ft OR small/medium/large)
6) Contact name
7) Phone
8) Email
9) Notes (optional)

Rules:
- Do NOT ask for patient or sensitive medical info.
- If asked about pricing: explain flat-rate proposal after a walkthrough.
- Once you have name + phone + email + service_type + (city or zip), confirm next steps and offer booking link.

Return JSON only:
{"reply":"...","lead":{"service_type":"","city":"","zip":"","frequency":"","preferred_time":"","size":"","name":"","phone":"","email":"","notes":""}}
`.trim();

    // ✅ Stable OpenAI call
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
      return res.status(200).json({
        reply: `OpenAI error: ${msg}`,
        lead: {},
      });
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
      !!lead.name &&
      !!lead.phone &&
      !!lead.email &&
      !!lead.service_type &&
      (!!lead.city || !!lead.zip);

    function closeMessage(serviceType) {
      const st = String(serviceType || "").toLowerCase();

      if (st.includes("medical")) {
        return (
          "Thanks — we’ve received your information.\n\n" +
          "For medical facilities, we follow detailed protocols focused on consistency, high-touch disinfection, and professional standards.\n\n" +
          "Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n"
        );
      }

      if (st.includes("bank")) {
        return (
          "Thanks — we’ve received your information.\n\n" +
          "For banks and financial facilities, we prioritize front-of-house presentation, secure-area awareness, and detailed floor/restroom care.\n\n" +
          "Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n"
        );
      }

      if (st.includes("property")) {
        return (
          "Thanks — we’ve received your information.\n\n" +
          "For property management, we help keep common areas, lobbies, stairwells, and turnover-ready spaces looking tenant-ready.\n\n" +
          "Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n"
        );
      }

      return (
        "Thanks — we’ve received your information.\n\n" +
        "Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n"
      );
    }

    let replyText = parsed.reply || "What city and ZIP is the facility in?";

    // ✅ If lead is complete, send to webhook and show booking link
    if (hasMinimum) {
      // send to Google Sheets/email webhook (never crash if it fails)
      if (process.env.LEAD_WEBHOOK_URL) {
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

      replyText =
        closeMessage(lead.service_type) +
        `✅ Book your walkthrough here:\n${bookingLink}\n\n` +
        "Or reply here and we can call/text you to schedule.\n\n" +
        "If this is urgent, call us now: 740-284-8500";
    }

    return res.status(200).json({
      reply: replyText,
      lead,
    });
  } catch (err) {
    return res.status(200).json({
      reply: `Server crash caught: ${String(err)}`,
      lead: {},
    });
  }
}
