// api/chat.js
// PURE AURA — CLEAN STEP FLOW VERSION

const APPS_SCRIPT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbxxxAOU39vKNFYU7jo75L3zUB8VhSG3_MvrvKlZWqtEcjBIrZraTnktXWY1OWG7zcgn/exec";

const CALENDLY =
  "https://calendly.com/management-pureauracleaningsolutions/30min";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { step = "start", message = "", lead = {} } = req.body;

    let nextStep = step;
    let updatedLead = { ...lead };
    let reply = "";

    // START
    if (step === "start") {
      nextStep = "facility";
      reply =
        "Good afternoon! I’m Aura 👋\n\nWhat type of facility is this?\n• Office\n• Medical Office\n• Bank\n• Property Management\n• Other";
    }

    // FACILITY
    else if (step === "facility") {
      updatedLead.service = message;
      nextStep = "location";
      reply = "Great! What city and ZIP code is the facility located in?";
    }

    // LOCATION
    else if (step === "location") {
      updatedLead.location = message;
      nextStep = "frequency";
      reply =
        "What cleaning frequency are you looking for?\n• One-time\n• Weekly\n• 2–3x per week\n• Nightly\n• Monthly";
    }

    // FREQUENCY
    else if (step === "frequency") {
      updatedLead.frequency = message;
      nextStep = "name";
      reply = "What’s the best contact name for this request?";
    }

    // NAME
    else if (step === "name") {
      updatedLead.name = message;
      nextStep = "email";
      reply = "What’s the best email address to send details to?";
    }

    // EMAIL
    else if (step === "email") {
      updatedLead.email = message;
      nextStep = "phone";
      reply = "What’s the best phone number to reach you?";
    }

    // PHONE (FINAL STEP)
    else if (step === "phone") {
      updatedLead.phone = message;

      // Send to Google Apps Script
      try {
        await fetch(APPS_SCRIPT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead: updatedLead })
        });
      } catch (e) {
        console.error("Webhook error:", e);
      }

      nextStep = "complete";
      reply =
        "Perfect — thank you! ✅ Your request has been sent.\n\nNext step: Book your walkthrough here:\n" +
        CALENDLY;
    }

    else {
      nextStep = "start";
      reply = "Let’s start again.";
    }

    return res.status(200).json({
      step: nextStep,
      lead: updatedLead,
      reply: reply
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};
