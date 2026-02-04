(function () {
  const backend = "https://pure-aura-chatbott.vercel.app/api/chat";

  const root = document.createElement("div");
  root.id = "pureaura-chat";
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "99999";
  root.style.width = "340px";
  root.style.maxWidth = "90vw";
  root.style.fontFamily = "system-ui";

  root.innerHTML = `
    <div id="pa-box" style="display:none;background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden;">
      <div style="padding:12px 14px;background:#0b3a6a;color:#fff;font-weight:700;">Pure Aura Assistant</div>
      <div id="pa-log" style="height:320px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;"></div>
      <div style="display:flex;gap:8px;padding:10px;border-top:1px solid #eee;">
        <input id="pa-in" placeholder="Type here…" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:10px;">
        <button id="pa-send" style="padding:10px 12px;border-radius:10px;border:0;background:#0b3a6a;color:#fff;">Send</button>
      </div>
    </div>
    <button id="pa-toggle" style="width:56px;height:56px;border-radius:999px;border:0;background:#0b3a6a;color:#fff;font-weight:800;">AI</button>
  `;

  document.body.appendChild(root);

  const toggle = root.querySelector("#pa-toggle");
  const box = root.querySelector("#pa-box");
  const log = root.querySelector("#pa-log");
  const input = root.querySelector("#pa-in");
  const send = root.querySelector("#pa-send");

  let messages = [];

  function bubble(text, who = "bot") {
    const b = document.createElement("div");
    b.style.maxWidth = "90%";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "12px";
    b.style.background = who === "bot" ? "#f3f5f7" : "#0b3a6a";
    b.style.color = who === "bot" ? "#111" : "#fff";
    b.style.alignSelf = who === "bot" ? "flex-start" : "flex-end";
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  }

  async function ask(text) {
    bubble(text, "user");
    messages.push({ role: "user", content: text });

    try {
      const r = await fetch(backend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          page_url: window.location.href
        })
      });

      const data = await r.json();
      bubble(data.reply || "What city and ZIP is the facility in?", "bot");
      messages.push({ role: "assistant", content: data.reply || "" });
    } catch (e) {
      bubble("Connection error. Please call 740-284-8500.", "bot");
    }
  }

  toggle.onclick = () => {
    box.style.display = box.style.display === "none" ? "block" : "none";
    if (log.childNodes.length === 0) {
      bubble("Hi! What type of facility is this: Office, Medical Office, Bank, Property Management, or Other?", "bot");
    }
  };

  send.onclick = () => {
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    ask(t);
  };

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") send.onclick();
  });
})();
