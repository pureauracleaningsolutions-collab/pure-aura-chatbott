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
    "https://pureaura-15xolc7fkt.live-website.com/wp-content/uploads/2026/02/A_professional_headshot_in_a_circular_format_featu.png";

  const bookingLink =
    "https://pureaura-15xolc7fkt.live-website.com/book-now/";
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

      return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) &&
        hour >= 8 &&
        hour < 18;
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

  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "99999";
  root.style.width = "390px";
  root.style.maxWidth = "92vw";
  root.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";

  root.innerHTML = `
    <div id="pa-box" style="display:none;background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,.16);overflow:hidden;">
      <div style="padding:12px 14px;background:${BRAND.primary};color:#fff;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:900;font-size:14px;">${BRAND.name}</div>
          <div id="pa-status" style="font-size:12px;opacity:.9;"></div>
        </div>
        <button id="pa-close" style="background:none;border:0;color:#fff;font-size:18px;cursor:pointer;">×</button>
      </div>

      <div id="pa-log" style="height:340px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:${BRAND.softBg};"></div>
      <div id="pa-quick" style="padding:0 12px 12px;display:flex;flex-wrap:wrap;gap:8px;background:${BRAND.softBg};"></div>

      <div style="display:flex;gap:8px;padding:10px;border-top:1px solid ${BRAND.border};">
        <input id="pa-in" placeholder="Type here…" style="flex:1;padding:10px;border-radius:12px;border:1px solid ${BRAND.border};">
        <button id="pa-send" style="background:${BRAND.primary};color:#fff;border:0;border-radius:12px;padding:10px 14px;font-weight:800;">Send</button>
      </div>
    </div>

    <button id="pa-toggle" style="width:60px;height:60px;border-radius:999px;border:0;background:${BRAND.primary};box-shadow:0 14px 30px rgba(0,0,0,.20);cursor:pointer;padding:0;overflow:hidden;position:relative;">
      <img id="pa-avatar" src="${avatarDay}" style="width:100%;height:100%;object-fit:cover;">
      <span id="pa-dot" style="position:absolute;right:6px;bottom:6px;width:12px;height:12px;border-radius:999px;background:#22c55e;border:2px solid #fff;"></span>
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
  const avatar = root.querySelector("#pa-avatar");
  const status = root.querySelector("#pa-status");

  let messages = [];
  let pulseOn = true;

  function updateStatus() {
    const open = isBusinessHoursET();
    dot.style.background = open ? "#22c55e" : "#f59e0b";
    avatar.src = open ? avatarDay : avatarAfterHours;
    status.textContent = open
      ? "🟢 Online — we can schedule now"
      : "🟡 After-hours — leave a message";
  }

  updateStatus();
  setInterval(updateStatus, 300000);

  setInterval(() => {
    if (!pulseOn) return;
    toggle.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
      { duration: 1400 }
    );
  }, 2400);

  function bubble(text, who) {
    const b = document.createElement("div");
    b.style.maxWidth = "92%";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "14px";
    b.style.background = who === "bot" ? BRAND.botBg : BRAND.primary;
    b.style.color = who === "bot" ? BRAND.text : "#fff";
    b.style.alignSelf = who === "bot" ? "flex-start" : "flex-end";
    b.innerHTML = text.replace(/\n/g, "<br>");
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  }

  function openChat() {
    pulseOn = false;
    updateStatus();
    box.style.display = "block";
    toggle.style.display = "none";

    if (!log.children.length) {
      bubble(
        `${timeGreetingET()}! I’m ${BRAND.assistantName}.\nWhat type of facility is this: Office, Medical Office, Bank, Property Management, or Other?`,
        "bot"
      );
      setQuick(["Office", "Medical Office", "Bank", "Property Management", "Other"]);
    }
  }

  function setQuick(items) {
    quick.innerHTML = "";
    items.forEach(label => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.border = `1px solid ${BRAND.border}`;
      btn.style.borderRadius = "999px";
      btn.style.padding = "8px 10px";
      btn.style.cursor = "pointer";
      btn.onclick = () => {
        if (label === "Book Walkthrough") window.open(bookingLink);
        else if (label === "Call Now") window.location.href = `tel:${phone}`;
        else if (label === "Email Me") window.location.href = `mailto:${email}`;
        else ask(label);
      };
      quick.appendChild(btn);
    });
  }

  async function ask(text) {
    bubble(text, "user");
    messages.push({ role: "user", content: text });
    quick.innerHTML = "";
    bubble("Typing…", "bot");

    const r = await fetch(backend, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, page_url: location.href })
    });

    const data = await r.json();
    log.lastChild.remove();
    bubble(data.reply, "bot");
    messages.push({ role: "assistant", content: data.reply });
    if (data.quick_replies) setQuick(data.quick_replies);
  }

  toggle.onclick = openChat;
  closeBtn.onclick = () => { box.style.display = "none"; toggle.style.display = "block"; updateStatus(); };
  send.onclick = () => { if (input.value) { ask(input.value); input.value = ""; } };
})();
