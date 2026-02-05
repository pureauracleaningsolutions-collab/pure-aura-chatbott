(function () {
  const backend = "https://pure-aura-chatbott.vercel.app/api/chat";

  // Brand settings
  const BRAND = {
    name: "Pure Aura Cleaning Solutions",
    slogan: "Elevate Your Environment",
    primary: "#0b3a6a",   // deep brand blue
    softBg: "#f6f9fc",
    cardBg: "#ffffff",
    botBg: "#eef3f8",
    border: "#d9e2ec",
    text: "#0b1220",
  };

  const bookingLink = "https://pureaura-15xolc7fkt.live-website.com/book-now/";
  const phone = "740-284-8500";
  const email = "management@pureauracleaningsolutions.com";

  const root = document.createElement("div");
  root.id = "pureaura-chat";
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "99999";
  root.style.width = "390px";
  root.style.maxWidth = "92vw";
  root.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";

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
        align-items:center;
        justify-content:space-between;
        gap:10px;
      ">
        <div style="display:flex;flex-direction:column;line-height:1.1;">
          <div style="font-weight:900;font-size:14px;">${BRAND.name}</div>
          <div style="font-weight:600;font-size:12px;opacity:.9;">${BRAND.slogan}</div>
        </div>
        <button id="pa-close" aria-label="Close chat" style="
          border:0;background:transparent;color:#fff;font-size:18px;
          cursor:pointer;line-height:1;padding:6px 8px;border-radius:10px;
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
        display:flex;gap:8px;padding:10px;border-top:1px solid ${BRAND.border};
        background:${BRAND.cardBg};
      ">
        <input id="pa-in" placeholder="Type here…" style="
          flex:1;
          padding:10px 12px;
          border:1px solid ${BRAND.border};
          border-radius:12px;
          outline:none;
          color:${BRAND.text};
        ">
        <button id="pa-send" style="
          padding:10px 14px;border-radius:12px;border:0;
          background:${BRAND.primary};color:#fff;font-weight:800;cursor:pointer;
        ">Send</button>
      </div>

      <div style="
        padding:10px 12px;
        border-top:1px dashed ${BRAND.border};
        background:${BRAND.cardBg};
        font-size:12px;color:#334155;
      ">
        Prefer to talk now? <a href="tel:${phone}" style="color:${BRAND.primary};font-weight:800;text-decoration:underline;">Call ${phone}</a>
      </div>
    </div>

    <button id="pa-toggle" aria-label="Open chat" style="
      width:60px;height:60px;border-radius:999px;border:0;
      background:${BRAND.primary};color:#fff;font-weight:900;
      box-shadow:0 14px 30px rgba(0,0,0,.20);
      cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      letter-spacing:.4px;
    ">
      AI
    </button>
  `;

  document.body.appendChild(root);

  const toggle = root.querySelector("#pa-toggle");
  const closeBtn = root.querySelector("#pa-close");
  const box = root.querySelector("#pa-box");
  const log = root.querySelector("#pa-log");
  const input = root.querySelector("#pa-in");
  const send = root.querySelector("#pa-send");
  const quick = root.querySelector("#pa-quick");

  let messages = [];

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

  function bubble(text, who = "bot") {
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
  }

  function setQuickReplies(items) {
    quick.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) return;

    items.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;

      // Pill style
      btn.style.padding = "8px 10px";
      btn.style.borderRadius = "999px";
      btn.style.border = `1px solid ${BRAND.border}`;
      btn.style.background = "#fff";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "900";
      btn.style.fontSize = "13px";
      btn.style.color = BRAND.text;

      btn.onmouseenter = () => (btn.style.borderColor = BRAND.primary);
      btn.onmouseleave = () => (btn.style.borderColor = BRAND.border);

      btn.onclick = () => {
        // ✅ Action buttons
        if (label === "Book Walkthrough") {
          window.open(bookingLink, "_blank", "noopener,noreferrer");
          return;
        }
        if (label === "Call Now") {
          window.location.href = `tel:${phone}`;
          return;
        }
        if (label === "Email Me") {
          window.location.href = `mailto:${email}?subject=Commercial%20Cleaning%20Inquiry%20-%20${encodeURIComponent(BRAND.name)}`;
          return;
        }

        // Otherwise send as a quick reply
        input.value = "";
        ask(label);
      };

      quick.appendChild(btn);
    });
  }

  function openChat() {
    box.style.display = "block";
    toggle.style.display = "none";
    if (log.childNodes.length === 0) {
      bubble(`Hi! I’m the ${BRAND.name} assistant.\nWhat type of facility is this: Office, Medical Office, Bank, Property Management, or Other?`, "bot");
      setQuickReplies(["Office", "Medical Office", "Bank", "Property Management", "Other"]);
    }
    input.focus();
  }

  function closeChat() {
    box.style.display = "none";
    toggle.style.display = "flex";
  }

  async function ask(userText) {
    bubble(userText, "user");
    messages.push({ role: "user", content: userText });
    setQuickReplies([]);

    bubble("…", "bot");
    const typingBubble = log.lastChild;

    try {
      const r = await fetch(backend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, page_url: window.location.href }),
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { reply: text }; }

      typingBubble.remove();

      if (!r.ok) {
        bubble(`ERROR (${r.status}): ${data?.error?.message || data?.reply || text}`, "bot");
        return;
      }

      bubble(data.reply || "What city and ZIP is the facility in?", "bot");
      messages.push({ role: "assistant", content: data.reply || "" });

      // The backend can return quick replies; we also support action buttons
      setQuickReplies(data.quick_replies || []);
    } catch (e) {
      typingBubble.remove();
      bubble(`NETWORK ERROR: ${e.message}`, "bot");
    }
  }

  toggle.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);

  send.addEventListener("click", () => {
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    ask(t);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send.click();
  });
})();
