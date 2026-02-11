// api/chat.js
// ✅ FULL FILE REPLACEMENT — Pure Aura AI Receptionist
// Phase 1: Lead capture (service → location → frequency → contact)
// Phase 2: Save to Google Sheets + email via Apps Script
// Phase 3: Calendly handoff
//
// Apps Script Webhook (LIVE):
// https://script.google.com/macros/s/AKfycbxxxAOU39vKNFYU7jo75L3zUB8VhSG3_MvrvKlZWqtEcjBIrZraTnktXWY1OWG7zcgn/exec

const APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbxxxAOU39vKNFYU7jo75L3zUB8VhSG3_MvrvKlZWqtEcjBIrZraTnktXWY1OWG7zcgn/exec";

const CALENDLY_BASE =
  "https://calendly.com/management-pureauracleaningsolutions/30min";

module.exports = async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const body = req.body || {};
    const step = body.step || "start";
    const lead = body.lead || {};
    const messages = [];

    // ---------- STEP FLOW ----------
    if (step === "start") {
      messages.push(
        "Good afternoon! I’m Aura 👋",
        "What type of facility is this?\n\n• Office\n• Medical Office\n• Bank\n• Property Management\n• Other"
      );
      return res.json({ messages, step: "facility" });
    }

    if (step === "facility") {
      messages.push("Great! What city and ZIP code is the facility located in?");
      return res.json({ messages, step: "location" });
    }

    if (step === "location") {
      messages.push(
        "What cleaning frequency are you looking for?\n\n• One-time\n• Weekly\n• 2–3x per week\n• Nightly\n• Monthly"
      );
      return res.json({ messages, step: "frequency" });
    }

    if (step === "frequency") {
      messages.push("What’s the best contact name for this request?");
      return res.json({ messages, step: "name" });
    }

    if (step === "name") {
      messages.push("Thanks! What’s the best email address to send details to?");
      return res.json({ messages, step: "email" });
    }

    if (step === "email") {
      messages.push("And finally, what’s the best phone number to reach you?");
      return res.json({ messages, step: "phone" });
    }

    // ---------- FINAL STEP ----------
    if (step === "phone") {
      // Send to Google Apps Script
      await fetch(APPS_SCRIPT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: {
            service_type: lead.service_type || "",
            city: lead.city || "",
            zip: lead.zip || "",
            frequency: lead.frequency || "",
            name: lead.name || "",
            email: lead.email || "",
            phone: lead.phone || "",
            notes: lead.notes || "",
            page_url: lead.page_url || "",
            page_title: lead.page_title || "",
            page_path: lead.page_path || ""
          },
          tags: ["chatbot", lead.service_type || "unknown"],
          dedupe_key:
            (lead.email || "") + "|" + (lead.phone || "")
        })
      });

      // Calendly prefill
      const params = new URLSearchParams();
      if (lead.name) params.append("name", lead.name);
      if (lead.email) params.append("email", lead.email);

      const calendlyLink = `${CALENDLY_BASE}?${params.toString()}`;

      messages.push(
        "Perfect — thank you! ✅",
        "Your request has been sent to our team.",
        "Next step: book a quick walkthrough so we can confirm scope and pricing.",
        calendlyLink
      );

      return res.json({
        messages,
        step: "complete",
        calendly: calendlyLink
      });
    }

    // ---------- FALLBACK ----------
    return res.json({
      messages: [
        "I’m sorry — something went wrong.",
        "Please call 740-284-8500 or email management@pureauracleaningsolutions.com."
      ],
      step: "error"
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(200).json({
      messages: [
        "Connection issue on our end.",
        "Please call 740-284-8500 or email management@pureauracleaningsolutions.com."
      ],
      step: "error"
    });
  }
};
