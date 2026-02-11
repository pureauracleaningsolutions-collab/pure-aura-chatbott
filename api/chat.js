// api/chat.js
// ✅ FULL FILE REPLACEMENT — Pure Aura AI Receptionist (Compatibility + Lead Capture)
// Fixes "Thanks — please continue" by returning BOTH:
// - reply: single string (older front-ends)
// - messages: array of strings (newer front-ends)
// Also captures answers server-side so Sheets works even if frontend state is weak.

const APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbxxxAOU39vKNFYU7jo75L3zUB8VhSG3_MvrvKlZWqtEcjBIrZraTnktXWY1OWG7zcgn/exec";

const CALENDLY_BASE =
  "https://calendly.com/management-pureauracleaningsolutions/30min";

const SERVICE_PAGES = {
  office: "https://pureauracleaningsolutions.com/office-cleaning-services/",
  bank: "https://pureauracleaningsolutions.com/bank-cleaning-services/",
  medical: "https://pureauracleaningsolutions.com/medical-office-cleaning/",
  property: "https://pureauracleaningsolutions.com/property-management-cleaning/",
  other: "https://pureauracleaningsolutions.com/book-now/",
};

function s(v) {
  return (v === undefined || v === null) ? "" : String(v).trim();
}

function normalizeServiceKey(serviceType) {
  const t = s(serviceType).toLowerCase();
  if (t.includes("medical")) return "medical";
  if (t.includes("bank")) return "bank";
  if (t.includes("property")) return "property";
  if (t.includes("office")) return "office";
  return "other";
}

function serviceLabel(serviceType) {
  const key = normalizeServiceKey(serviceType);
  if (key === "medical") return "Medical Office Cleaning";
  if (key === "bank") return "Bank Cleaning Services";
  if (key === "property") return "Property Management Cleaning";
  if (key === "office") return "Office Cleaning Services";
  return "Commercial Cleaning";
}

function looksLikeEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(email));
}

function digitsOnlyPhone(phone) {
  return s(phone).replace(/[^\d]/g, "");
}

function pickServicePage(serviceType) {
  const key = normalizeServiceKey(serviceType);
  return SERVICE_PAGES[key] || SERVICE_PAGES.other;
}

function joinMessages(arr) {
  return (arr || []).filter(Boolean).join("\n\n");
}

module.exports = async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = req.body || {};

    // Compatibility inputs (front-end may send any of these)
    const step = s(body.step) || "start";
    const userText = s(body.message || body.text || body.user_message || body.input);

    // Front-end may send lead object; we will also build it server-side
    const lead = Object.assign(
      {
        service_type: "",
        city: "",
        zip: "",
        frequency: "",
        preferred_time: "",
        size: "",
        name: "",
        email: "",
        phone: "",
        notes: "",
        page_url: "",
        page_title: "",
        page_path: "",
      },
      body.lead || {}
    );

    // --- Server-side capture based on step and userText ---
    // If frontend already filled lead fields, we keep them; if not, we fill from userText.
    if (step === "facility" && userText && !lead.service_type) {
      lead.service_type = userText;
    }
    if (step === "location" && userText) {
      // Try to parse "City 15205" or "Pittsburgh, PA 15205"
      if (!lead.city || !lead.zip) {
        const zipMatch = userText.match(/\b(\d{5})\b/);
        if (zipMatch && !lead.zip) lead.zip = zipMatch[1];
        if (!lead.city) {
          // City is everything before ZIP (or full text if no ZIP)
          const cityGuess = zipMatch
            ? userText.slice(0, zipMatch.index).replace(/[,]+/g, " ").trim()
            : userText.trim();
          lead.city = cityGuess;
        }
      }
    }
    if (step === "frequency" && userText && !lead.frequency) {
      lead.frequency = userText;
    }
    if (step === "name" && userText && !lead.name) {
      lead.name = userText;
    }
    if (step === "email" && userText && !lead.email) {
      lead.email = userText;
    }
    if (step === "phone" && userText && !lead.phone) {
      lead.phone = userText;
    }

    const messages = [];

    // --- Conversation flow ---
    if (step === "start") {
      messages.push(
        "Good afternoon! I’m Aura 👋",
        "What type of facility is this?\n\n• Office\n• Medical Office\n• Bank\n• Property Management\n• Other"
      );
      const reply = joinMessages(messages);
      return res.json({ step: "facility", messages, reply, lead });
    }

    if (step === "facility") {
      // Save service choice if it came in this request (userText)
      if (userText) lead.service_type = userText;
      messages.push("Great! What city and ZIP code is the facility located in?");
      const reply = joinMessages(messages);
      return res.json({ step: "location", messages, reply, lead });
    }

    if (step === "location") {
      messages.push(
        "What cleaning frequency are you looking for?\n\n• One-time\n• Weekly\n• 2–3x per week\n• Nightly\n• Monthly"
      );
      const reply = joinMessages(messages);
      return res.json({ step: "frequency", messages, reply, lead });
    }

    if (step === "frequency") {
      messages.push("What’s the best contact name for this request?");
      const reply = joinMessages(messages);
      return res.json({ step: "name", messages, reply, lead });
    }

    if (step === "name") {
      messages.push("Thanks! What’s the best email address to send details to?");
      const reply = joinMessages(messages);
      return res.json({ step: "email", messages, reply, lead });
    }

    if (step === "email") {
      // If user typed something not email, ask again (prevents broken leads)
      if (!looksLikeEmail(lead.email)) {
        messages.push("That doesn’t look like an email. What’s the best email address to send details to?");
        const reply = joinMessages(messages);
        return res.json({ step: "email", messages, reply, lead });
      }
      messages.push("And finally, what’s the best phone number to reach you?");
      const reply = joinMessages(messages);
      return res.json({ step: "phone", messages, reply, lead });
    }

    if (step === "phone") {
      lead.phone = digitsOnlyPhone(lead.phone || userText);

      // Basic validation — if missing key info, recover
      if (!lead.service_type) {
        messages.push("What type of facility is this?\n\n• Office\n• Medical Office\n• Bank\n• Property Management\n• Other");
        const reply = joinMessages(messages);
        return res.json({ step: "facility", messages, reply, lead });
      }
      if (!lead.city || !lead.zip) {
        messages.push("What city and ZIP code is the facility located in?");
        const reply = joinMessages(messages);
        return res.json({ step: "location", messages, reply, lead });
      }
      if (!lead.frequency) {
        messages.push("What cleaning frequency are you looking for? (one-time, weekly, 2–3x/week, nightly, monthly)");
        const reply = joinMessages(messages);
        return res.json({ step: "frequency", messages, reply, lead });
      }
      if (!lead.name) {
        messages.push("What’s the best contact name for this request?");
        const reply = joinMessages(messages);
        return res.json({ step: "name", messages, reply, lead });
      }
      if (!looksLikeEmail(lead.email)) {
        messages.push("What’s the best email address to send details to?");
        const reply = joinMessages(messages);
        return res.json({ step: "email", messages, reply, lead });
      }
      if (!lead.phone || lead.phone.length < 10) {
        messages.push("What’s the best phone number to reach you? (10 digits)");
        const reply = joinMessages(messages);
        return res.json({ step: "phone", messages, reply, lead });
      }

      // --- Send lead to Apps Script webhook ---
      const serviceKey = normalizeServiceKey(lead.service_type);
      const tags = ["chatbot", serviceKey];
      const dedupe_key = `${lead.email}|${lead.phone}`;

      const webhookResp = await fetch(APPS_SCRIPT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, tags, dedupe_key }),
      });

      // If webhook fails, still give user booking, but tell them to call (fail-safe)
      if (!webhookResp.ok) {
        messages.push(
          "Thanks — please continue by booking your walkthrough here:",
          CALENDLY_BASE,
          "If you need immediate help, call 740-284-8500."
        );
        const reply = joinMessages(messages);
        return res.json({ step: "complete", messages, reply, lead });
      }

      // Service page routing + Calendly prefill
      const servicePage = pickServicePage(lead.service_type);

      const params = new URLSearchParams();
      params.append("name", lead.name);
      params.append("email", lead.email);
      // optional tag
      params.append("a1", serviceKey);

      const calendly = `${CALENDLY_BASE}?${params.toString()}`;

      messages.push(
        "Perfect — thank you! ✅ Your request has been sent.",
        "Here is the service page with full scope details:",
        servicePage,
        "Next step: book a quick walkthrough so we can confirm scope and pricing:",
        calendly
      );

      const reply = joinMessages(messages);
      return res.json({ step: "complete", messages, reply, lead, calendly, service_page: servicePage });
    }

    // Fallback
    messages.push(
      "Thanks — please continue.",
      "If you need help right now, call 740-284-8500 or email management@pureauracleaningsolutions.com."
    );
    const reply = joinMessages(messages);
    return res.json({ step: "start", messages, reply, lead });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(200).json({
      step: "error",
      messages: [
        "Connection issue on our end.",
        "Please call 740-284-8500 or email management@pureauracleaningsolutions.com.",
      ],
      reply: "Connection issue on our end. Please call 740-284-8500 or email management@pureauracleaningsolutions.com.",
    });
  }
};
