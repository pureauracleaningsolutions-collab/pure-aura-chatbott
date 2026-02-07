// api/chat.js
// ✅ FULL FILE REPLACEMENT — Calendly prefill upgrade (paste once)
// Includes: crash-proof, anti-spam honeypot, basic rate-limit, dedupe, tags,
// Google Apps Script webhook (no Make), optional Pushover notifications.
//
// Calendly base:
// https://calendly.com/management-pureauracleaningsolutions/30min
//
// Prefill: adds ?name=...&email=... (and first_name for compatibility)
// IMPORTANT: Make sure your frontend sends messages[] and hp:"" (blank).

module.exports = async function handler(req, res) {
  // ---------------- CORS ----------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ---------------- In-memory rate-limit + dedupe ----------------
  global.__PA_RL = global.__PA_RL || new Map(); // ip -> {count, resetAt}
  global.__PA_DEDUPE = global.__PA_DEDUPE || new Map(); // key -> expireAt

  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 min
  const RATE_LIMIT_MAX = 25;
  const DEDUPE_TTL_MS = 15 * 60 * 1000; // 15 min

  function getIP(req) {
    const xf = req.headers["x-forwarded-for"];
    if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
    return (req.socket && req.socket.remoteAddress) || "unknown";
  }

  function rateLimitOrOk(ip) {
    const now = Date.now();
    const entry = global.__PA_RL.get(ip);
    if (!entry || now > entry.resetAt) {
      global.__PA_RL.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }
    entry.count += 1;
    global.__PA_RL.set(ip, entry);
    return entry.count <= RATE_LIMIT_MAX;
  }

  function dedupeSeen(key) {
    const now = Date.now();

    // small cleanup
    if (global.__PA_DEDUPE.size > 800) {
      for (const [k, exp] of global.__PA_DEDUPE.entries()) {
        if (now > exp) global.__PA_DEDUPE.delete(k);
      }
    }

    const exp = global.__PA_DEDUPE.get(key);
    if (exp && now < exp) return true;

    global.__PA_DEDUPE.set(key, now + DEDUPE_TTL_MS);
    return false;
  }

  function normalizePhone(p) {
    return String(p || "").replace(/[^\d]/g, "");
  }

  // ---------------- Time helpers (ET) ----------------
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
    const text = [l?.frequency, l?.preferred_time, l?.notes].join(" ").toLowerCase();
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

  function serviceLabel(type) {
    const t = String(type || "").toLowerCase();
    if (t.includes("medical")) return "Medical Office Cleaning";
    if (t.includes("bank")) return "Bank Cleaning Services";
    if (t.includes("property")) return "Property Management Cleaning";
    if (t.includes("office")) return "Office Cleaning Services";
    return "Commercial Cleaning";
  }

  function buildTags(l) {
    const tags = [];
    const upper = serviceLabel(l?.service_type).toUpperCase();
    if (upper.includes("BANK")) tags.push("BANK");
    if (upper.includes("MEDICAL")) tags.push("MEDICAL");
    if (upper.includes("OFFICE")) tags.push("OFFICE");
    if (upper.includes("PROPERTY")) tags.push("PROPERTY");
    const loc = [l?.city, l?.zip].filter(Boolean).join(" ").trim();
    if (loc) tags.push(loc);
    return tags;
  }

  function nextQuickReplies(l) {
    if (!l?.service_type) return ["Office", "Medical Office", "Bank", "Property Management", "Other"];
    if (!l?.city && !l?.zip)
      return ["Pittsburgh 15205", "Crafton 15205", "Steubenville 43952", "Weirton 26062", "Other"];
    if (!l?.frequency) return ["One-time", "Weekly", "2–3x/week", "Nightly", "Monthly"];
    if (!l?.preferred_time) return ["After-hours", "Daytime", "Weekends", "Flexible"];
    if (!l?.size) return ["Small", "Medium", "Large", "Not sure"];
    if (!l?.name) return ["(Type your name)"];
    if (!l?.phone) return ["(Type phone)"];
    if (!l?.email) return ["(Type email)"];
    return [];
  }

  // ✅ Calendly prefill link (robust: supports multiple field names)
  function buildCalendlyLink(lead) {
    const base = "https://calendly.com/management-pureauracleaningsolutions/30min";

    // Pull from multiple possible names to guarantee we get it
    const nameRaw =
      (lead?.name ??
        lead?.full_name ??
        lead?.contact_name ??
        lead?.first_name ??
        lead?.lead_name ??
        "")
        .toString()
        .trim();

    const emailRaw =
      (lead?.email ?? lead?.email_address ?? lead?.contact_email ?? lead?.lead_email ?? "")
        .toString()
        .trim();

    const firstName = nameRaw ? nameRaw.split(" ")[0] : "";

    const params = new URLSearchParams();
    if (firstName) params.set("first_name", firstName); // extra compatibility
    if (nameRaw) params.set("name", nameRaw);
    if (emailRaw) params.set("email", emailRaw);

    const finalUrl = `${base}?${params.toString()}`;

    // Helpful debug — check Vercel logs to confirm it contains name/email
    console.log("Calendly Prefill URL:", finalUrl);

    return finalUrl;
  }

  function buildProposalDraft(l, bookingLink) {
    const label = serviceLabel(l?.service_type);
    const location = [l?.city, l?.zip].filter(Boolean).join(" ");
    const freq = l?.frequency || "TBD";
    const window = l?.preferred_time || "TBD";
    const size = l?.size || "TBD";
    const notes = l?.notes ? `Notes: ${l.notes}` : "";

    const scopes = (() => {
      const t = String(l?.service_type || "").toLowerCase();
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
    const bodyText =
      `Client: ${l?.name || ""}\n` +
      `Service: ${label}\n` +
      `Location: ${location || "TBD"}\n` +
      `Frequency: ${freq}\n` +
      `Preferred Window: ${window}\n` +
      `Size: ${size}\n` +
      `${notes}\n\n` +
      `Recommended Scope:\n- ${scopes.join("\n- ")}\n\n` +
      `Compliance & Trust:\n- ${trust.join("\n- ")}\n\n` +
      `Next Step (Walkthrough):\n${bookingLink}\n\n` +
      `Contact:\n740-284-8500 | management@pureauracleaningsolutions.com`;

    return { subject, body: bodyText, scopes, trust };
  }

  // ---------------- MAIN ----------------
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ reply: "POST only", lead: {}, quick_replies: [] });
    }

    const ip = getIP(req);
    if (!rateLimitOrOk(ip)) {
      return res.status(200).json({
        reply: "Thanks! One moment — please try again shortly.",
        lead: {},
        quick_replies: [],
      });
    }

    // Safe body parse
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body && typeof body === "object" ? body : {};

    // Honeypot anti-spam
    const hp = typeof body.hp === "string" ? body.hp.trim() : "";
    if (hp) {
      return res.status(200).json({
        reply: "Thanks! If you need immediate help, call 740-284-8500.",
        lead: {},
        quick_replies: [],
      });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const page_url = typeof body.page_url === "string" ? body.page_url : "";
    const page_title = typeof body.page_title === "string" ? body.page_title : "";
    const page_path = typeof body.page_path === "string" ? body.page_path : "";

    // Your Apps Script webhook
    const APPS_SCRIPT_WEBHOOK_URL =
      "https://script.google.com/macros/s/AKfycbw4Dc2Amr1GxXcYeLJfmUW9MVWF4h_ng8jhJD7rNDt6gfRgo9D4bjnA6KCm8RjxRQrxew/exec";

    // Must have OpenAI key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply:
          "Server setup error: OPENAI_API_KEY is missing in Vercel → Settings → Environment Variables (Production). Save it, then Redeploy.",
        lead: {},
        quick_replies: [],
      });
    }

    // If no messages, start the flow
    if (messages.length === 0) {
      return res.status(200).json({
        reply: "Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?",
        lead: {},
        quick_replies: ["Office", "Medical Office", "Bank", "Property Management", "Other"],
      });
    }

    // System prompt: enforce JSON response with lead object
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

    // OpenAI call
    let openaiJson;
    try {
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

      openaiJson = await r.json();

      if (!r.ok) {
        const msg = openaiJson?.error?.message || JSON.stringify(openaiJson);
        return res.status(200).json({ reply: `OpenAI error: ${msg}`, lead: {}, quick_replies: [] });
      }
    } catch (err) {
      return res.status(200).json({
        reply: "Connection issue. Please try again in a moment.",
        lead: {},
        quick_replies: [],
      });
    }

    const outText = openaiJson?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(outText);
    } catch {
      parsed = { reply: outText || "What city and ZIP is the facility in?", lead: {} };
    }

    const lead = parsed.lead && typeof parsed.lead === "object" ? parsed.lead : {};
    lead.page_url = page_url;
    lead.page_title = page_title;
    lead.page_path = page_path;

    const tags = buildTags(lead);

    const hasMinimum =
      !!lead.name &&
      !!lead.phone &&
      !!lead.email &&
      !!lead.service_type &&
      (!!lead.city || !!lead.zip);

    // Default reply + quick replies (continue lead qualification)
    let replyText =
      parsed.reply && typeof parsed.reply === "string"
        ? parsed.reply
        : "What city and ZIP is the facility in?";

    let quick_replies = nextQuickReplies(lead);

    // If lead is complete, send to Sheets + notify + give Calendly link
    if (hasMinimum) {
      const duringHours = isBusinessHoursET();
      const urgent = isUrgentLead(lead);

      const bookingLink = buildCalendlyLink(lead);
      const proposal = buildProposalDraft(lead, bookingLink);

      const dedupeKey = [
        (lead.email || "").toLowerCase(),
        normalizePhone(lead.phone),
        (lead.service_type || "").toLowerCase(),
        String(lead.zip || ""),
      ].join("|");

      if (!dedupeSeen(dedupeKey)) {
        // Send to Apps Script (never crash if it fails)
        try {
          await fetch(APPS_SCRIPT_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead,
              proposal,
              tags,
              dedupe_key: dedupeKey,
              meta: { duringHours, urgent, timeBucket: timeBucketET(), ip },
            }),
          });
        } catch (e) {
          console.log("Apps Script webhook error:", String(e));
        }

        // Optional Pushover
        const poUser = process.env.PUSHOVER_USER_KEY;
        const poToken = process.env.PUSHOVER_APP_TOKEN;

        if (poUser && poToken) {
          try {
            const priority = urgent ? "1" : "0";
            const sound = quietHoursET() && !urgent ? "none" : "pushover";
            const location = [lead.city, lead.zip].filter(Boolean).join(" ");

            const msg =
              `Tags: ${tags.join(", ")}\n` +
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
      }

      replyText =
        `Thanks — we’ve received your information.\n\n` +
        `Next step: a quick walkthrough so we can confirm scope and send a flat-rate proposal within 24 hours.\n\n` +
        `✅ Book your walkthrough here (Name + Email pre-filled):\n${bookingLink}\n\n` +
        `${
          duringHours
            ? `✅ We’re open now — call 740-284-8500 and we can schedule immediately.`
            : `✅ After-hours note: we’ll follow up the next business day. If urgent, call 740-284-8500.`
        }\n` +
        `Or email: management@pureauracleaningsolutions.com`;

      quick_replies = ["Book Walkthrough", "Call Now", "Email Me"];
    }

    // Always return valid JSON
    return res.status(200).json({
      reply: replyText,
      lead,
      tags,
      quick_replies,
    });
  } catch (err) {
    console.log("FATAL handler error:", err);
    return res.status(200).json({
      reply:
        "Quick setup issue on our end. Please call 740-284-8500 or email management@pureauracleaningsolutions.com.",
      lead: {},
      tags: [],
      quick_replies: ["Call Now", "Email Me"],
    });
  }
};
