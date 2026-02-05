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

  // 👩 AVATARS (public URLs)
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

  // ---- UI ----
  const root = document.createElement("div");
  root.id = "pureaura-chat";
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "99999";
  root.style.width = "390px";
  root.st
