export default async function handler(req, res) {
  // CORS so WordPress can call this endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") return res.status(200).json({ reply: "POST only", lead: {} });

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const page_url = typeof body.page_url === "string" ? body.page_url : "";

    const bookingLink = "https://pureaura-15xolc7fkt.live-website.com/book-now/";
    const phone = "740-284-8500";
    const email = "management@pureauracleaningsolutions.com";

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply: "Server setup error: OPENAI_API_KEY is missing in Vercel Environment Variables (Production).",
        lead: {},
        quick_replies: [],
      });
    }

    // Local business hours (ET): Mon–Fri 8am–6pm
    function isBusinessHoursET() {
      try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
          hour: "2-digit",
          hour12: false,
        }).formatToParts(now);
        const weekday = parts.find(p => p.type === "weekday")?.value || "";
        const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
        const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
        return isWeekday && hour >= 8 && hour < 18;
      } catch {
        return true;
      }
    }

    // If no messages, greet + quick replies
    if (messages.length === 0) {
      return res.status(200).json({
        reply: "Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?",
        lead: {},
        quick_replies: ["Office", "Medical Office", "Bank", "Property Management", "Other"],
      });
    }

    const system = `
You are the Pure Aura Cleaning Solutions website assistant.
Primary goal: capture qualified commercial cleaning leads and then offer a walkthrough booking link.

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

    // OpenAI call (stable)
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
          ...messages.map(m => ({
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
      return res.status(200).json({ reply: `OpenAI error: ${msg}`, lead: {}, quick_replies: [] });
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
          "For medical facilities, we follow detailed protocols focused on consistency, high-touch disinfection, and professional standards.\n\n"
        );
      }
      if (st.includes("bank")) {
        return (
          "Thanks — we’ve received your information.\n\n" +
          "For banks and financial facilities, we prioritize front-of-house presentation, secure-area awareness, and detailed floor/restroom care.\n\n"
        );
      }
      if (st.includes("property")) {
        return (
          "Thanks — we’ve received your information.\n\n" +
          "For property management, we help keep common areas, lobbies, stairwells, and turnover-ready spaces tenant-ready.\n\n"
        );
      }
      return "Thanks — we’ve received your information.\n\n";
    }

    // QUICK REPLIES logic (based on what’s missing)
    function nextQuickReplies(l) {
      if (!l.service_type) return ["Office", "Medical Office", "Bank", "Property Management", "Other"];
      if (!l.city && !l.zip) return ["Pittsburgh 15205", "Steubenville 43952", "Weirton 26062", "Crafton 15205"];
      if (!l.frequency) return ["One-time", "Weekly", "2–3x/week", "Nightly", "Monthly"];
      if (!l.preferred_time) return ["After-hours", "Daytime", "Weekends", "Flexible"];
      if (!l.size) return ["Small", "Medium", "Large", "Not sure"];
      if (!l.name) return ["(Type your name)"];
      if (!l.phone) return ["(Type phone)"];
      if (!l.email) return ["(Type email)"];
      return [];
    }

    let replyText = parsed.reply || "What city and ZIP is the facility in?";
    let quick_replies = nextQuickReplies(lead);

    // Webhook + booking + human takeover + SMS (optional)
    if (hasMinimum) {
      // Send lead to Sheets/email webhook (safe)
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

      // Optional SMS alert via Twilio (only if env vars exist)
      const twSid = process.env.TWILIO_ACCOUNT_SID;
      const twTok = process.env.TWILIO_AUTH_TOKEN;
      const twFrom = process.env.TWILIO_FROM;
      const ownerPhone = process.env.OWNER_PHONE;

      if (twSid && twTok && twFrom && ownerPhone) {
        try {
          const auth = Buffer.from(`${twSid}:${twTok}`).toString("base64");
          const smsBody =
            `NEW LEAD (${lead.service_type || "Commercial"})\n` +
            `${lead.city || ""} ${lead.zip || ""}\n` +
            `Freq: ${lead.frequency || ""}, Time: ${lead.preferred_time || ""}, Size: ${lead.size || ""}\n` +
            `Name: ${lead.name || ""}\nPhone: ${lead.phone || ""}\nEmail: ${lead.email || ""}`;

          const params = new URLSearchParams();
          params.append("From", twFrom);
          params.append("To", ownerPhone);
          params.append("Body", smsBody);

          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });
        } catch (e) {
          console.log("Twilio SMS error:", String(e));
        }
      }

      const duringHours = isBusinessHoursET();
      const humanLine = duringHours
        ? `✅ We’re open now — if you’d like, call us at ${phone} and we can schedule immediately.`
        : `✅ After-hours note: we’ll follow up the next business day. If urgent, call ${phone}.`;

      replyText =
        closeMessage(lead.service_type) +
        "Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n" +
        `✅ Book your walkthrough here:\n${bookingLink}\n\n` +
        humanLine + "\n" +
        `Or email: ${email}`;

      quick_replies = ["Book Walkthrough", "Call Now", "Text Me", "Email Me"];
    }

    return res.status(200).json({
      reply: replyText,
      lead,
      quick_replies,
    });
  } catch (err) {
    return res.status(200).json({
      reply: `Server crash caught: ${String(err)}`,
      lead: {},
      quick_replies: [],
    });
  }
}

