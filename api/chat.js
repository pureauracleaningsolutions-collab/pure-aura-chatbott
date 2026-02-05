(function () {
  const backend = "https://pure-aura-chatbott.vercel.app/api/chat";

  // 🔵 BRAND SETTINGS
  const BRAND = {
    name: "Pure Aura Cleaning Solutions",
    slogan: "Elevate Your Environment",
    assistantName: "Aura",
    primary: "#0b3a6a",
    softBg: "#f6f9fc",
    cardBg: "#ffffff",
    botBg: "#eef3f8",
    border: "#d9e2ec",
    text: "#0b1220",
  };

  // 👩 AVATARS
  const avatarDay =
    "https://pureaura-15xolc7fkt.live-website.com/wp-content/uploads/2026/02/ai-receptionist-photo.png";
  const avatarAfterHours =
    "https://pureaura-15xolc7fkt.live-website.com/wp-content/uploads/2026/02/night-shift-ai-receptionist.png";

  const bookingLink = "https://pureaura-15xolc7fkt.live-website.com/book-now/";
  const phone = "740-284-8500";
  const email = "management@pureauracleaningsolutions.com";

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

  function timeGreetingET() {
    try {
      const hr = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          hour12: false,
        }).format(new Date())
      );

      if (hr < 12) return "Good morning";
      if (hr < 18) return "Good afternoon";
      return "Good evening";
    } catch {
      const hr = new Date().getHours();
      if (hr < 12) return "Good morning";
      if (hr < 18) return "Good afternoon";
      return "Good evening";
    }
  }

  // ✅ Page-aware service detection (based on your URLs)
  function detectServiceFromPage() {
    const path = (location.pathname || "").toLowerCase();

    if (path.includes("/bank-cleaning-services/")) {
      return { key: "bank", label: "Bank Cleaning Services" };
    }
    if (path.includes("/medical-office-cleaning/")) {
      return { key: "medical", label: "Medical Office Cleaning" };
    }
    if (path.includes("/office-cleaning-services/")) {
      return { key: "office", label: "Office Cleaning Services" };
    }

    return null; // unknown / homepage / other pages
  }

  // ✅ GA4 helper (safe if GA is not installed)
  function gaEvent(name, params) {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", name, params || {});
      }
    } catch {}
  }

  // ---- UI ----
  const root = document.createElement("div");
  root.id = "pureaura-chat";
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "99999";
  root.style.width = "390px";
  root.style.maxWidth = "92vw";
  root.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";

  root.innerHTML = `
    <div id="pa-box" style="
      display:none;
      background:${BRAND.cardBg};
      border:1px solid ${BRAND.border};
      border-radius:18px;
      box-shadow:0 14px 40px rgba(0,0,0,.16);
      overflow:hidden;
    ">
      <div style="
        padding:12px 14px;
        background:${BRAND.primary};
        color:#fff;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      ">
        <div style="display:flex;align-items:center;gap:10px;">
          <img id="pa-header-avatar" src="${avatarDay}" alt="Aura" style="
            width:36px;height:36px;border-radius:999px;
            object-fit:cover;display:block;
            border:2px solid rgba(255,255,255,.85);
            box-shadow:0 6px 18px rgba(0,0,0,.20);
          ">
          <div style="display:flex;flex-direction:column;line-height:1.1;">
            <div style="font-weight:900;font-size:14px;">${BRAND.name}</div>
            <div style="font-size:12px;opacity:.95;font-weight:800;">
              ${BRAND.assistantName} • ${BRAND.name}
            </div>
            <div id="pa-status" style="font-size:12px;opacity:.90;">${BRAND.slogan}</div>
          </div>
        </div>

        <button id="pa-close" aria-label="Close chat" style="
          background:none;border:0;color:#fff;font-size:18px;cursor:pointer;
          padding:6px 10px;border-radius:10px;
        ">×</button>
      </div>

      <div id="pa-log" style="
        height:340px;
        overflow:auto;
        padding:12px;
        display:flex;
        flex-direction:column;
        gap:10px;
        background:${BRAND.softBg};
      "></div>

      <div id="pa-quick" style="
        padding:0 12px 12px;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        background:${BRAND.softBg};
      "></div>

      <div style="
        display:flex;gap:8px;padding:10px;
        border-top:1px solid ${BRAND.border};
        background:${BRAND.cardBg};
      ">
        <input id="pa-in" placeholder="Type here…" style="
          flex:1;
          padding:10px 12px;
          border-radius:12px;
          border:1px solid ${BRAND.border};
          outline:none;
        ">
        <button id="pa-send" style="
          background:${BRAND.primary};
          color:#fff;
          border:0;
          border-radius:12px;
          padding:10px 14px;
          font-weight:900;
          cursor:pointer;
        ">Send</button>
      </div>
    </div>

    <button id="pa-toggle" aria-label="Open chat" title="Chat with us" style="
      width:60px;height:60px;border-radius:999px;border:0;
      background:${BRAND.primary};
      box-shadow:0 14px 30px rgba(0,0,0,.20);
      cursor:pointer;padding:0;overflow:hidden;
      position:relative;
      transform: translateZ(0);
    ">
      <img id="pa-avatar" src="${avatarDay}" alt="Pure Aura Assistant" style="
        width:100%;height:100%;
        object-fit:cover;
        display:block;
      ">
      <span id="pa-dot" style="
        position:absolute;right:6px;bottom:6px;
        width:12px;height:12px;border-radius:999px;
        background:#22c55e;border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.25);
      "></span>
    </button>
  `;

  document.body.appendChild(root);

  const box = root.querySelector("#pa-box");
  const toggle = root.querySelector("#pa-toggle");
  const closeBtn = root.querySelector("#pa-close");
  const log = root.querySelector("#pa-log");
  const quick = root.querySelector("#pa-quick");
  const input = root.querySelector("#pa-in");
  const send = root.querySelector("#pa-send");
  const dot = root.querySelector("#pa-dot");
  const avatarImg = root.querySelector("#pa-avatar");
  const headerAvatar = root.querySelector("#pa-header-avatar");
  const statusLine = root.querySelector("#pa-status");

  let messages = [];
  let pulseOn = true;

  // Gentle pulse (stops after opening once)
  setInterval(() => {
    if (!pulseOn) return;
    toggle.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
      { duration: 1400, iterations: 1 }
    );
  }, 2400);

  toggle.addEventListener("mouseenter", () => (toggle.style.transform = "scale(1.04)"));
  toggle.addEventListener("mouseleave", () => (toggle.style.transform = "scale(1)"));

  function setOnlineVisuals() {
    const open = isBusinessHoursET();
    dot.style.background = open ? "#22c55e" : "#f59e0b";

    const src = open ? avatarDay : avatarAfterHours;
    avatarImg.src = src;
    if (headerAvatar) headerAvatar.src = src;

    if (statusLine) {
      statusLine.textContent = open ? "🟢 Online — we can schedule now" : "🟡 After-hours — leave a message";
    }
  }

  setOnlineVisuals();
  setInterval(setOnlineVisuals, 5 * 60 * 1000);

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderRich(text) {
    return escapeHtml(text)
      .replace(/\n/g, "<br>")
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        `<a href="$1" target="_blank" rel="noopener noreferrer" style="color:${BRAND.primary};text-decoration:underline;font-weight:900;">$1</a>`
      );
  }

  function bubble(text, who) {
    const b = document.createElement("div");
    b.style.maxWidth = "92%";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "14px";
    b.style.background = who === "bot" ? BRAND.botBg : BRAND.primary;
    b.style.color = who === "bot" ? BRAND.text : "#fff";
    b.style.alignSelf = who === "bot" ? "flex-start" : "flex-end";
    b.style.wordBreak = "break-word";
    b.style.border = who === "bot" ? `1px solid ${BRAND.border}` : "0";
    b.innerHTML = renderRich(String(text));
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function typingBubble() {
    const b = document.createElement("div");
    b.style.maxWidth = "60%";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "14px";
    b.style.background = BRAND.botBg;
    b.style.color = BRAND.text;
    b.style.alignSelf = "flex-start";
    b.style.border = `1px solid ${BRAND.border}`;

    const label = document.createElement("span");
    label.textContent = `${BRAND.assistantName} is typing`;
    label.style.fontWeight = "800";

    const dots = document.createElement("span");
    dots.textContent = "";
    dots.style.marginLeft = "6px";
    dots.style.fontWeight = "900";

    b.appendChild(label);
    b.appendChild(dots);

    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % 4;
      dots.textContent = ".".repeat(i);
    }, 350);

    b._stop = () => clearInterval(t);

    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function setQuick(items) {
    quick.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) return;

    items.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;

      btn.style.border = `1px solid ${BRAND.border}`;
      btn.style.borderRadius = "999px";
      btn.style.padding = "8px 10px";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "900";
      btn.style.background = "#fff";

      btn.onmouseenter = () => (btn.style.borderColor = BRAND.primary);
      btn.onmouseleave = () => (btn.style.borderColor = BRAND.border);

      btn.onclick = () => {
        if (label === "Book Walkthrough") {
          window.open(bookingLink, "_blank", "noopener,noreferrer");
          return;
        }
        if (label === "Call Now") {
          window.location.href = `tel:${phone}`;
          return;
        }
        if (label === "Email Me") {
          window.location.href =
            `mailto:${email}?subject=` +
            encodeURIComponent("Commercial Cleaning Inquiry - Pure Aura Cleaning Solutions");
          return;
        }
        ask(label);
      };

      quick.appendChild(btn);
    });
  }

  // ✅ Page-aware intro logic
  function openChat() {
    pulseOn = false;
    setOnlineVisuals();

    box.style.display = "block";
    toggle.style.display = "none";

    gaEvent("pa_chat_open", {
      page_location: location.href,
      page_path: location.pathname,
      page_title: document.title || "",
    });

    if (!log.children.length) {
      const greet = timeGreetingET();
      const service = detectServiceFromPage();

      // Inject silent context message once (not shown to the visitor)
      if (service) {
        messages.push({
          role: "user",
          content: `(Context) Visitor is currently on the "${service.label}" page at ${location.href}.`,
        });
      } else {
        messages.push({
          role: "user",
          content: `(Context) Visitor is on page "${document.title || "Unknown"}" at ${location.href}.`,
        });
      }

      if (service) {
        bubble(
          `${greet}! I’m ${BRAND.assistantName}.\nI see you’re looking for **${service.label}**.\n\nWhat city and ZIP is the facility in?`,
          "bot"
        );
        setQuick(["Pittsburgh 15205", "Crafton 15205", "Steubenville 43952", "Weirton 26062", "Other"]);
      } else {
        bubble(
          `${greet}! I’m ${BRAND.assistantName}.\nWhat type of facility is this: Office, Medical Office, Bank, Property Management, or Other?`,
          "bot"
        );
        setQuick(["Office", "Medical Office", "Bank", "Property Management", "Other"]);
      }
    }

    input.focus();
  }

  async function ask(text) {
    const userText = String(text || "").trim();
    if (!userText) return;

    gaEvent("pa_chat_message", {
      page_location: location.href,
      page_path: location.pathname,
    });

    bubble(userText, "user");
    messages.push({ role: "user", content: userText });
    quick.innerHTML = "";

    const tb = typingBubble();

    try {
      const r = await fetch(backend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          page_url: location.href,
          page_title: document.title || "",
          page_path: location.pathname || "",
        }),
      });

      const raw = await r.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { reply: raw };
      }

      if (tb && tb._stop) tb._stop();
      if (tb && tb.remove) tb.remove();

      if (!r.ok) {
        bubble(`Quick setup issue. Please call ${phone} or email ${email}.`, "bot");
        return;
      }

      const reply = data.reply || "What city and ZIP is the facility in?";
      bubble(reply, "bot");
      messages.push({ role: "assistant", content: reply });

      // If backend indicates lead completion, track it
      if (Array.isArray(data.quick_replies) && data.quick_replies.includes("Book Walkthrough")) {
        gaEvent("pa_lead_completed", {
          page_location: location.href,
          page_path: location.pathname,
        });
      }

      if (data.quick_replies) setQuick(data.quick_replies);
    } catch (e) {
      if (tb && tb._stop) tb._stop();
      if (tb && tb.remove) tb.remove();
      bubble(`Connection issue. Please call ${phone} or email ${email}.`, "bot");
    }
  }

  toggle.onclick = openChat;

  closeBtn.onclick = () => {
    box.style.display = "none";
    toggle.style.display = "block";
    setOnlineVisuals();
    gaEvent("pa_chat_close", { page_location: location.href, page_path: location.pathname });
  };

  send.onclick = () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    ask(v);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send.click();
  });
})();
