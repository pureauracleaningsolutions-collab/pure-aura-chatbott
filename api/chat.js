export default async function handler(req, res) {
  // CORS for WordPress + any site embedding
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

    // --- ENV VARS REQUIRED ---
    // OPENAI_API_KEY
    // Optional:
    // LEAD_WEBHOOK_URL (Make/Zapier webhook that writes to Google Sheets + emails you)
    // AFTER_HOURS_WEBHOOK_URL (Make/Zapier webhook that emails the customer after-hours)
    // PUSHOVER_USER_KEY + PUSHOVER_APP_TOKEN (push alert to your phone)

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply: "Server setup error: OPENAI_API_KEY is missing in Vercel Environment Variables (Production).",
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

    // Quick replies based on missing info
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

    // Greeting if no messages
    if (messages.length === 0) {
      return res.status(200).json({
        reply: "Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?",
        lead: {},
        quick_replies: ["Office", "Medical Office", "Bank", "Property Management", "Other"],
      });
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

    // --- OPENAI CALL ---
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
    lead.page_url = page_url;
    lead.page_title = page_title;
    lead.page_path = page_path;

    const hasMinimum =
      !!lead.name &&
      !!lead.phone &&
      !!lead.email &&
      !!lead.service_type &&
      (!!lead.city || !!lead.zip);

    function serviceLabel(type) {
      const t = String(type || "").toLowerCase();
      if (t.includes("medical")) return "Medical Office Cleaning";
      if (t.includes("bank")) return "Bank Cleaning Services";
      if (t.includes("property")) return "Property Management Cleaning";
      if (t.includes("office")) return "Office Cleaning Services";
      return "Commercial Cleaning";
    }

    // --- PROPOSAL DRAFT (NO EXTRA AI COST) ---
    function buildProposalDraft(l) {
      const label = serviceLabel(l.service_type);
      const location = [l.city, l.zip].filter(Boolean).join(" ");
      const freq = l.frequency || "TBD";
      const window = l.preferred_time || "TBD";
      const size = l.size || "TBD";
      const notes = l.notes ? `Notes: ${l.notes}` : "";

      // Scopes by service
      const scopes = (() => {
        const t = String(l.service_type || "").toLowerCase();
        if (t.includes("bank")) {
          return [
            "Lobby & entry glass/doors detail-cleaned",
            "Teller line & customer areas (surfaces, fingerprints, trash)",
            "Restrooms sanitized & restocked",
            "Floors: vacuum/mop + spot treatment",
            "Secure-area awareness & professional, discreet service",
          ];
        }
        if (t.includes("medical")) {
          return [
            "High-touch disinfection (door handles, switches, counters)",
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
        // office default
        return [
          "Trash removal & liner replacement",
          "Dusting/wipe-down of desks (clear surfaces), ledges, and touchpoints",
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
        `Recommended Scope (bullet points):\n- ${scopes.join("\n- ")}\n\n` +
        `Compliance & Trust:\n- ${trust.join("\n- ")}\n\n` +
        `Next Step (Walkthrough):\n${bookingLink}\n\n` +
        `Contact:\n${phone} | ${email}`;

      return { subject, body, scopes, trust };
    }

    const proposal = buildProposalDraft(lead);

    // --- FRONTEND REPLY ---
    let replyText = parsed.reply || "What city and ZIP is the facility in?";
    let quick_replies = nextQuickReplies(lead);

    if (hasMinimum) {
      const duringHours = isBusinessHoursET();
      const urgent = isUrgentLead(lead);

      // Send lead to Google Sheets + internal email (Make/Zapier)
      if (process.env.LEAD_WEBHOOK_URL) {
        try {
          await fetch(process.env.LEAD_WEBHOOK_URL, {
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
          console.log("LEAD_WEBHOOK_URL error:", String(e));
        }
      }

      // After-hours customer auto-follow-up trigger (Make/Zapier)
      // Your Make scenario should send an email to lead.email using the proposal.subject/body.
      if (!duringHours && process.env.AFTER_HOURS_WEBHOOK_URL) {
        try {
          await fetch(process.env.AFTER_HOURS_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: lead.email,
              to_name: lead.name,
              subject:
                `Thanks for contacting ${BRAND?.name || "Pure Aura Cleaning Solutions"} — we’ll follow up next business day`,
              // A simple, professional follow-up
              message:
                `Hi ${lead.name || ""},\n\n` +
                `Thanks for reaching out to Pure Aura Cleaning Solutions. We received your request for ${serviceLabel(lead.service_type)}.\n\n` +
                `We’re currently after-hours, but we’ll follow up the next business day to confirm details and schedule a quick walkthrough.\n\n` +
                `If you’d like to book now, you can use this link:\n${bookingLink}\n\n` +
                `If it’s urgent, call us at ${phone}.\n\n` +
                `— Pure Aura Cleaning Solutions\n${email}`,
              lead,
              proposal,
            }),
          });
        } catch (e) {
          console.log("AFTER_HOURS_WEBHOOK_URL error:", String(e));
        }
      }

      // Pushover alert
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
          params.append("priority", priority);
          params.append("sound", sound);

          if (page_url) {
            params.append("url", page_url);
            params.append("url_title", "Open Page");
          }

          await fetch("https://api.pushover.net/1/messages.json", {
            method: "POST",
            body: params,
          });
        } catch (e) {
          console.log("Pushover error:", String(e));
        }
      }

      // Customer-facing closeout message
      replyText =
        `Thanks — we’ve received your information.\n\n` +
        `Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n` +
        `✅ Book your walkthrough here:\n${bookingLink}\n\n` +
        `${duringHours ? `✅ We’re open now — call us at ${phone} and we can schedule immediately.` : `✅ After-hours note: we’ll follow up the next business day. If urgent, call ${phone}.`}\n` +
        `Or email: ${email}`;

      quick_replies = ["Book Walkthrough", "Call Now", "Email Me"];
    }

    return res.status(200).json({
      reply: replyText,
      lead,
      proposal, // included for debugging / optional use
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
