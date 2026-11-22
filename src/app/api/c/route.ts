import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function maskIp(ip: string): string {
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

function parseSource(referrer: string): string {
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

function parseUserAgent(ua: string) {
  if (!ua || typeof ua !== "string") {
    return { device: "Desktop", os: "Unknown", browser: "Unknown", isBot: false };
  }

  const isBot = /bot|crawl|spider|slurp|lighthouse|headless|ptst/i.test(ua);

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

export async function POST(req: Request) {
  try {
    const rawIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    const userAgent = req.headers.get("user-agent") || "";
    const { device, os, browser, isBot } = parseUserAgent(userAgent);

    if (isBot) {
      return NextResponse.json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

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
      return NextResponse.json({ ok: true, ignored: true }, { headers: corsHeaders });
    }

    const city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city") || "";
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "";
    const location = city && country ? `${city}, ${country}` : country || city || "Unknown";
    const maskedIp = maskIp(rawIp);
    const source = parseSource(referrer);
    const now = new Date();

    const db = await getMongoDb("Apethexhelpportal");
    const col = db.collection("livevisits");

    const existing = await col.findOne({ visit_id });

    if (!existing) {
      const priorCount = await col.countDocuments({ visitor_id });
      const visitCount = priorCount + 1;

      await col.insertOne({
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
    } else {
      const updateDoc: any = {
        $set: {
          last_seen: now,
        },
      };

      if (type === "pageview") {
        const timeline = existing.timeline || [];
        const lastPv = [...timeline].reverse().find((item: any) => item.type === "pageview");
        if (lastPv) {
          const diffSeconds = Math.max(0, Math.round((now.getTime() - new Date(lastPv.time).getTime()) / 1000));
          lastPv.time_on_page = diffSeconds;
        }

        const firstSeen = new Date(existing.first_seen || now);
        updateDoc.$set.current_page = page;
        updateDoc.$set.pages_viewed = (existing.pages_viewed || 1) + 1;
        updateDoc.$set.time_on_site = Math.max(0, Math.round((now.getTime() - firstSeen.getTime()) / 1000));
        updateDoc.$set.timeline = [
          ...timeline,
          {
            time: now,
            page,
            type: "pageview",
            time_on_page: 0,
          },
        ];
      } else if (type === "heartbeat") {
        const timeline = existing.timeline || [];
        if (duration > 0) {
          const lastPv = [...timeline].reverse().find((item: any) => item.type === "pageview");
          if (lastPv) {
            lastPv.time_on_page = Math.max(lastPv.time_on_page || 0, Math.round(duration));
          }
          updateDoc.$set.timeline = timeline;
        }
        const firstSeen = new Date(existing.first_seen || now);
        updateDoc.$set.time_on_site = Math.max(0, Math.round((now.getTime() - firstSeen.getTime()) / 1000));
      } else if (type === "contact_form_submit") {
        updateDoc.$set.form_sent = true;
        updateDoc.$push = {
          timeline: {
            time: now,
            page,
            type: "contact_form_submit",
            meta: {},
            time_on_page: 0,
          },
        };
      } else if (type === "apply_click") {
        updateDoc.$set.apply_clicked = true;
        if (role) updateDoc.$set.apply_role = role;
        updateDoc.$push = {
          timeline: {
            time: now,
            page,
            type: "apply_click",
            meta: { role },
            time_on_page: 0,
          },
        };
      }

      await col.updateOne({ visit_id }, updateDoc);
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[collector] error:", err?.message || err);
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  }
}
