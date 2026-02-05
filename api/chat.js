export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return res.status(200).json({ reply: "POST only", lead: {}, quick_replies: [] });
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const page_url = typeof body.page_url === "string" ? body.page_url : "";
    const page_title = typeof body.page_title === "string" ? body.page_title : "";
    const page_path = typeof body.page_path === "string" ? body.page_path : "";

    const bookingLink = "https://pureaura-15xolc7fkt.live-website.com/book-now/";
    const phone = "740-284-8500";
    const email = "management@pureauracleaningsolutions.com";

    // ✅ Your Google Apps Script Webhook (NO Make.com)
    const APPS_SCRIPT_WEBHOOK_URL =
      "https://script.google.com/macros/s/AKfycbw4Dc2Amr1GxXcYeLJfmUW9MVWF4h_ng8jhJD7rNDt6gfRgo9D4bjnA6KCm8RjxRQrxew/exec";

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply: "Server setup error: OPENAI_API_KEY is missing in Vercel → Environment Variables (Production).",
        lead: {},
        quick_replies: [],
      });
    }

    // Business hours ET: Mon–Fri 8am–6pm
    function isBusinessHoursET() {
      try {
        const now = new Date();
        const weekday = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
        }).format(now);

        const hour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            hour: "2-digit",
            hour12: false,
          }).format(now)
        );

        const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
        return isWeekday && hour >= 8 && hour < 18;
      } catch {
        return true;
      }
    }

    function timeBucketET() {
      try {
        const hr = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            hour: "2-digit",
            hour12: false,
          }).format(new Date())
        );
        if (hr < 12) return "morning";
        if (hr < 18) return "afternoon";
        return "evening";
      } catch {
        return "day";
      }
    }

    // Quiet hours for Pushover sound control (9pm–7am ET)
    function quietHoursET() {
      try {
        const hour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            hour: "2-digit",
            hour12: false,
          }).format(new Date())
        );
        return hour >= 21 || hour < 7;
      } catch {
        return false;
      }
    }

    function isUrgentLead(l) {
      const text = [l.frequency, l.preferred_time, l.notes].join(" ").toLowerCase();
      return (
        text.includes("urgent") ||
        text.includes("asap") ||
        text.includes("today") ||
        text.includes("tonight") ||
        text.includes("emergency") ||
        text.includes("same day") ||
        text.includes("same-day")
      );
    }

    function nextQuickReplies(l) {
      if (!l.service_type) return ["Office", "Medical Office", "Bank", "Property Management", "Other"];
      if (!l.city && !l.zip) return ["Pittsburgh 15205", "Crafton 15205", "Steubenville 43952", "Weirton 26062", "Other"];
      if (!l.frequency) return ["One-time", "Weekly", "2–3x/week", "Nightly", "Monthly"];
      if (!l.preferred_time) return ["After-hours", "Daytime", "Weekends", "Flexible"];
      if (!l.size) return ["Small", "Medium", "Large", "Not sure"];
      if (!l.name) return ["(Type your name)"];
      if (!l.phone) return ["(Type phone)"];
      if (!l.email) return ["(Type email)"];
      return [];
    }

    function serviceLabel(type) {
      const t = String(type || "").toLowerCase();
      if (t.includes("medical")) return "Medical Office Cleaning";
      if (t.includes("bank")) return "Bank Cleaning Services";
      if (t.includes("property")) return "Property Management Cleaning";
      if (t.includes("office")) return "Office Cleaning Services";
      return "Commercial Cleaning";
    }

    function buildProposalDraft(l) {
      const label = serviceLabel(l.service_type);
      const location = [l.city, l.zip].filter(Boolean).join(" ");
      const freq = l.frequency || "TBD";
      const window = l.preferred_time || "TBD";
      const size = l.size || "TBD";
      const notes = l.notes ? `Notes: ${l.notes}` : "";

      const scopes = (() => {
        const t = String(l.service_type || "").toLowerCase();
        if (t.includes("bank")) {
          return [
            "Lobby & entry glass/doors detail-cleaned",
            "Teller line & customer areas (surfaces, fingerprints, trash)",
            "Restrooms sanitized & restocked",
            "Floors: vacuum/mop + spot treatment",
            "Secure-area awareness & discreet professional service",
          ];
        }
        if (t.includes("medical")) {
          return [
            "High-touch disinfection (handles, switches, counters)",
            "Exam rooms & waiting areas cleaned per protocol",
            "Restrooms sanitized & restocked",
            "Floors: vacuum/mop + spot treatment",
            "Professional standards for healthcare environments",
          ];
        }
        if (t.includes("property")) {
          return [
            "Lobbies, hallways, stairwells & common areas",
            "Trash removal & liner replacement",
            "Restrooms sanitized (if applicable)",
            "Floors: vacuum/mop + spot treatment",
            "Turnover-ready cleanup support on request",
          ];
        }
        return [
          "Trash removal & liner replacement",
          "Dusting/wipe-down of touchpoints & ledges",
          "Breakroom/kitchenette cleaned (counters, sinks, exterior appliances)",
          "Restrooms sanitized & restocked",
          "Floors: vacuum/mop + spot treatment",
        ];
      })();

      const trust = [
        "Insured service",
        "Background-checked staff",
        "Consistent checklists & quality control",
        "After-hours options available",
      ];

      const subject = `Proposal Draft — ${label} (${location || "Location TBD"})`;
      const body =
        `Client: ${l.name || ""}\n` +
        `Service: ${label}\n` +
        `Location: ${location || "TBD"}\n` +
        `Frequency: ${freq}\n` +
        `Preferred Window: ${window}\n` +
        `Size: ${size}\n` +
        `${notes}\n\n` +
        `Recommended Scope:\n- ${scopes.join("\n- ")}\n\n` +
        `Compliance & Trust:\n- ${trust.join("\n- ")}\n\n` +
        `Next Step (Walkthrough):\n${bookingLink}\n\n` +
        `Contact:\n${phone} | ${email}`;

      return { subject, body, scopes, trust };
    }

    // --- SYSTEM PROMPT ---
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
- Do NOT ask for patient details or sensitive medical info.
- If asked about pricing: explain flat-rate proposal after a walkthrough.
- Once you have name + phone + email + service_type + (city or zip), confirm next steps and offer booking link.

Return JSON only:
{"reply":"...","lead":{"service_type":"","city":"","zip":"","frequency":"","preferred_time":"","size":"","name":"","phone":"","email":"","notes":""}}
`.trim();

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

    const openai = await r.json();

    if (!r.ok) {
      const msg = openai?.error?.message || JSON.stringify(openai);
      return res.status(200).json({ reply: `OpenAI error: ${msg}`, lead: {}, quick_replies: [] });
    }

    const outText = openai?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(outText);
    } catch {
      parsed = { reply: outText || "What city and ZIP is the facility in?", lead: {} };
    }

    const lead = parsed.lead || {};
    lead.page_url = page_url;
    lead.page_title = page_title;
    lead.page_path = page_path;

    const hasMinimum =
      !!lead.name &&
      !!lead.phone &&
      !!lead.email &&
      !!lead.service_type &&
      (!!lead.city || !!lead.zip);

    let replyText = parsed.reply || "What city and ZIP is the facility in?";
    let quick_replies = nextQuickReplies(lead);

    // Build proposal draft (always available)
    const proposal = buildProposalDraft(lead);

    if (hasMinimum) {
      const duringHours = isBusinessHoursET();
      const urgent = isUrgentLead(lead);

      // ✅ Send to Google Sheets + Gmail via Apps Script webhook
      try {
        await fetch(APPS_SCRIPT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead,
            proposal,
            meta: {
              duringHours,
              urgent,
              timeBucket: timeBucketET(),
            },
          }),
        });
      } catch (e) {
        console.log("Apps Script webhook error:", String(e));
      }

      // Optional Pushover alert
      const poUser = process.env.PUSHOVER_USER_KEY;
      const poToken = process.env.PUSHOVER_APP_TOKEN;

      if (poUser && poToken) {
        try {
          const priority = urgent ? "1" : "0";
          const sound = quietHoursET() && !urgent ? "none" : "pushover";

          const location = [lead.city, lead.zip].filter(Boolean).join(" ");
          const msg =
            `Service: ${serviceLabel(lead.service_type)}\n` +
            `Location: ${location}\n` +
            `Frequency: ${lead.frequency || ""}\n` +
            `Preferred Time: ${lead.preferred_time || ""}\n` +
            `Size: ${lead.size || ""}\n\n` +
            `Name: ${lead.name || ""}\n` +
            `Phone: ${lead.phone || ""}\n` +
            `Email: ${lead.email || ""}\n\n` +
            `Page: ${page_url || ""}\n\n` +
            `Proposal Subject:\n${proposal.subject}`;

          const params = new URLSearchParams();
          params.append("token", poToken);
          params.append("user", poUser);
          params.append("title", urgent ? "🚨 Urgent Lead" : "✨ New Lead");
          params.append("message", msg);
          params.append("
