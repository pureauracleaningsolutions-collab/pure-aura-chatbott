(function () {
  const backend = "https://pure-aura-chatbott.vercel.app/api/chat";
  const bookingLink = "https://pureaura-15xolc7fkt.live-website.com/book-now/";
  const phone = "740-284-8500";
  const email = "management@pureauracleaningsolutions.com";

  const root = document.createElement("div");
  root.id = "pureaura-chat";
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "99999";
  root.style.width = "380px";
  root.style.maxWidth = "92vw";
  root.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";

  root.innerHTML = `
    <div id="pa-box" style="display:none;background:#fff;border:1px solid #ddd;border-radius:16px;box-shadow:0 12px 34px rgba(0,0,0,.16);overflow:hidden;">
      <div style="padding:12px 14px;background:#0b3a6a;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:space-between;">
        <span>Pure Aura Assistant</span>
        <button id="pa-close" style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer;line-height:1;">×</button>
      </div>

      <div id="pa-log" style="height:330px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:#fafbfc;"></div>

      <div id="pa-quick" style="padding:0 12px 12px;display:flex;flex-wrap:wrap;gap:8px;background:#fafbfc;"></div>

      <div style="display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff;">
        <input id="pa-in" placeholder="Type here…" style="flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:12px;outline:none;">
        <button id="pa-send" style="padding:10px 14px;border-radius:12px;border:0;background:#0b3a6a;color:#fff;font-weight:700;cursor:pointer;">Send</button>
      </div>
    </div>

    <button id="pa-toggle" style="width:58px;height:58px;border-radius:999px;border:0;background:#0b3a6a;color:#fff;font-weight:900;box-shadow:0 12px 26px rgba(0,0,0,.20);cursor:pointer;">
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
    // clickable links + line breaks
    return escapeHtml(text)
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;font-weight:800;">$1</a>');
  }

  function bubble(text, who = "bot") {
    const b = document.createElement("div");
    b.style.maxWidth = "92%";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "14px";
    b.style.background = who === "bot" ? "#f1f4f7" : "#0b3a6a";
    b.style.color = who === "bot" ? "#111" : "#fff";
    b.style.alignSelf = who === "bot" ? "flex-start" : "flex-end";
    b.style.wordBreak = "break-word";
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
      btn.style.padding = "8px 10px";
      btn.style.borderRadius = "999px";
      btn.style.border = "1px solid #d6dbe1";
      btn.style.background = "#fff";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "700";
      btn.style.fontSize = "13px";

      btn.onclick = () => {
        // special actions
        if (label === "Book Walkthrough") {
          window.open(bookingLink, "_blank", "noopener,noreferrer");
          return;
        }
        if (label === "Call Now") {
          window.location.href = `tel:${phone}`;
          return;
        }
        if (label === "Email Me") {
          window.location.href = `mailto:${email}`;
          return;
        }
        if (label === "Text Me") {
          bubble("What’s the best mobile number to text you?", "bot");
          return;
        }

        // normal quick reply sends as user message
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
      bubble("Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?", "bot");
      setQuickReplies(["Office", "Medical Office", "Bank", "Property Management", "Other"]);
    }
    input.focus();
  }

  function closeChat() {
    box.style.display = "none";
    toggle.style.display = "block";
  }

  async function ask(userText) {
    bubble(userText, "user");
    messages.push({ role: "user", content: userText });
    setQuickReplies([]);

    // typing
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
