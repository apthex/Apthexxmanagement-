import express from "express";
import cors from "cors";
import LiveVisit from "../models/LiveVisit.js";

const router = express.Router();

// Allow public site origins to send collector beacons
router.use(
  cors({
    origin: true,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

function maskIp(ip) {
  if (!ip) return "Unknown";
  const cleaned = ip.replace(/^::ffff:/, "").trim();
  if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
    }
  } else if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    return `${parts.slice(0, 3).join(":")}:x`;
  }
  return "Unknown";
}

function parseSource(referrer) {
  if (!referrer || typeof referrer !== "string" || !referrer.trim()) {
    return "Direct";
  }
  try {
    const url = new URL(referrer.startsWith("http") ? referrer : `https://${referrer}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host.includes("linkedin.com") || host === "lnkd.in") return "LinkedIn";
    if (host.includes("instagram.com") || host === "l.instagram.com") return "Instagram";
    if (host.includes("google.")) return "Google";
    if (host === "tally.so" || host.endsWith(".tally.so")) return "Tally";
    if (host === "x.com" || host === "t.co" || host.includes("twitter.com")) return "X";
    if (host.includes("apthex.com") || host === "localhost" || host === "127.0.0.1") return "Direct";

    return host;
  } catch {
    return "Direct";
  }
}

function parseUserAgent(ua) {
  if (!ua || typeof ua !== "string") {
    return { device: "Desktop", os: "Unknown", browser: "Unknown", isBot: false };
  }

  const isBot = /bot|crawl|spider|slurp|lighthouse|headless|ptst/i.test(ua);

  // Device & OS
  let device = "Desktop";
  let os = "Unknown";

  if (/Android/i.test(ua)) {
    device = /Mobile/i.test(ua) ? "Android" : "Tablet";
    os = "Android";
  } else if (/iPad/i.test(ua)) {
    device = "Tablet";
    os = "iOS";
  } else if (/iPhone/i.test(ua)) {
    device = "iOS";
    os = "iOS";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = "macOS";
    os = "macOS";
  } else if (/Windows/i.test(ua)) {
    device = "Windows";
    os = "Windows";
  } else if (/Linux/i.test(ua)) {
    device = "Linux";
    os = "Linux";
  }

  // Browser
  let browser = "Other";
  if (/Edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/Chrome\/|CriOS\//i.test(ua)) {
    browser = "Chrome";
  } else if (/Firefox\/|FxiOS\//i.test(ua)) {
    browser = "Firefox";
  } else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) {
    browser = "Safari";
  } else if (/Opera|OPR\//i.test(ua)) {
    browser = "Opera";
  }

  return { device, os, browser, isBot };
}

router.post("/", async (req, res) => {
  try {
    const rawIp =
      req.headers["cf-connecting-ip"] ||
      (req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0].trim() : null) ||
      req.ip ||
      req.socket?.remoteAddress ||
      "";

    const userAgent = req.headers["user-agent"] || "";
    const { device, os, browser, isBot } = parseUserAgent(userAgent);

    // Fail silently / ignore known bots
    if (isBot) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const body = req.body || {};
    const {
      visit_id,
      visitor_id,
      page = "/",
      referrer = "",
      type = "pageview",
      role = "",
      duration = 0,
    } = body;

    if (!visit_id || !visitor_id) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const city = req.headers["cf-ipcity"] || req.headers["x-vercel-ip-city"] || "";
    const country = req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || "";
    const location = city && country ? `${city}, ${country}` : country || city || "Unknown";
    const maskedIp = maskIp(rawIp);
    const source = parseSource(referrer);
    const now = new Date();

    let visit = await LiveVisit.findOne({ visit_id });

    if (!visit) {
      // First time visit
      const priorVisitsCount = await LiveVisit.countDocuments({ visitor_id });
      const visitCount = priorVisitsCount + 1;

      visit = new LiveVisit({
        visit_id,
        visitor_id,
        ip: rawIp,
        ip_masked: maskedIp,
        city: city || "",
        country: country || "",
        location,
        device,
        os,
        browser,
        source,
        entry_page: page,
        current_page: page,
        pages_viewed: 1,
        time_on_site: 0,
        first_seen: now,
        last_seen: now,
        visit_count: visitCount,
        form_sent: type === "contact_form_submit",
        apply_clicked: type === "apply_click",
        apply_role: role || "",
        timeline: [
          {
            time: now,
            page,
            type,
            meta: role ? { role } : undefined,
            time_on_page: 0,
          },
        ],
      });
      await visit.save();
    } else {
      visit.last_seen = now;

      if (type === "pageview") {
        // Calculate time on previous page
        const lastPv = [...visit.timeline].reverse().find((item) => item.type === "pageview");
        if (lastPv) {
          const diffSeconds = Math.max(0, Math.round((now - new Date(lastPv.time)) / 1000));
          lastPv.time_on_page = diffSeconds;
        }

        visit.pages_viewed += 1;
        visit.current_page = page;
        visit.time_on_site = Math.max(0, Math.round((now - new Date(visit.first_seen)) / 1000));

        visit.timeline.push({
          time: now,
          page,
          type: "pageview",
          time_on_page: 0,
        });
      } else if (type === "heartbeat") {
        if (duration > 0) {
          const lastPv = [...visit.timeline].reverse().find((item) => item.type === "pageview");
          if (lastPv) {
            lastPv.time_on_page = Math.max(lastPv.time_on_page || 0, Math.round(duration));
          }
        }
        visit.time_on_site = Math.max(0, Math.round((now - new Date(visit.first_seen)) / 1000));
      } else if (type === "contact_form_submit") {
        visit.form_sent = true;
        visit.timeline.push({
          time: now,
          page,
          type: "contact_form_submit",
          meta: {},
          time_on_page: 0,
        });
      } else if (type === "apply_click") {
        visit.apply_clicked = true;
        if (role) visit.apply_role = role;
        visit.timeline.push({
          time: now,
          page,
          type: "apply_click",
          meta: { role },
          time_on_page: 0,
        });
      }

      await visit.save();
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Analytics collector must fail silently
    console.error("[collector] error:", err?.message || err);
    return res.status(200).json({ ok: true });
  }
});

export default router;
