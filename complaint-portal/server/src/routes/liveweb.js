import express from "express";
import LiveVisit from "../models/LiveVisit.js";

const router = express.Router();

function getFilterDates(query) {
  const range = query.range || "today";
  const now = new Date();
  let start = new Date(now);

  if (range === "today") {
    // Start of day in IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    istNow.setUTCHours(0, 0, 0, 0);
    start = new Date(istNow.getTime() - istOffset);
  } else if (range === "7d") {
    start.setDate(now.getDate() - 7);
  } else if (range === "30d") {
    start.setDate(now.getDate() - 30);
  } else if (range === "custom" && query.from) {
    start = new Date(query.from);
  } else {
    start.setDate(now.getDate() - 7);
  }

  let end = now;
  if (range === "custom" && query.to) {
    end = new Date(query.to);
  }

  return { start, end };
}

function sanitizeCsvField(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Mitigate CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

// 6.2 Overview
router.get("/overview", async (req, res) => {
  try {
    const { start, end } = getFilterDates(req.query);
    const dateFilter = { first_seen: { $gte: start, $lte: end } };

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onSiteNow = await LiveVisit.countDocuments({ last_seen: { $gte: fiveMinsAgo } });

    const visits = await LiveVisit.find(dateFilter).lean();

    const uniqueVisitors = new Set(visits.map((v) => v.visitor_id)).size;
    const totalPageViews = visits.reduce((acc, v) => acc + (v.pages_viewed || 1), 0);
    const totalTime = visits.reduce((acc, v) => acc + (v.time_on_site || 0), 0);
    const avgTimeOnSite = visits.length ? Math.round(totalTime / visits.length) : 0;
    const formsSent = visits.filter((v) => v.form_sent).length;
    const applyClicks = visits.filter((v) => v.apply_clicked).length;

    // Visitors Per Day (Line chart data)
    const dayMap = {};
    const istOffset = 5.5 * 60 * 60 * 1000;

    visits.forEach((v) => {
      const istDate = new Date(new Date(v.first_seen).getTime() + istOffset);
      const dayKey = istDate.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          date: dayKey,
          label: istDate.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" }),
          visitors: new Set(),
          pageViews: 0,
        };
      }
      dayMap[dayKey].visitors.add(v.visitor_id);
      dayMap[dayKey].pageViews += v.pages_viewed || 1;
    });

    const visitorsPerDay = Object.keys(dayMap)
      .sort()
      .map((k) => ({
        date: dayMap[k].date,
        label: dayMap[k].label,
        visitors: dayMap[k].visitors.size,
        pageViews: dayMap[k].pageViews,
      }));

    // Top Pages
    const pageCounts = {};
    visits.forEach((v) => {
      (v.timeline || []).forEach((t) => {
        if (t.type === "pageview" && t.page) {
          pageCounts[t.page] = (pageCounts[t.page] || 0) + 1;
        }
      });
    });
    const topPages = Object.entries(pageCounts)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Top Sources
    const sourceCounts = {};
    visits.forEach((v) => {
      const src = v.source || "Direct";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const topSources = Object.entries(sourceCounts)
      .map(([source, visitors]) => ({ source, visitors }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 5);

    // Top Cities
    const cityCounts = {};
    visits.forEach((v) => {
      const city = v.city || (v.location && v.location !== "Unknown" ? v.location.split(",")[0] : null);
      if (city) {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });
    const topCities = Object.entries(cityCounts)
      .map(([city, visitors]) => ({ city, visitors }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 5);

    return res.json({
      onSiteNow,
      metrics: {
        visitors: uniqueVisitors,
        totalVisits: visits.length,
        pageViews: totalPageViews,
        avgTimeOnSite,
        avgTimeOnSiteFormatted: formatDuration(avgTimeOnSite),
        formsSent,
        applyClicks,
      },
      visitorsPerDay,
      topPages,
      topSources,
      topCities,
    });
  } catch (err) {
    console.error("[liveweb/overview]", err);
    return res.status(500).json({ error: "Failed to fetch overview metrics" });
  }
});

// 6.3 Live
router.get("/live", async (req, res) => {
  try {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeVisits = await LiveVisit.find({ last_seen: { $gte: fiveMinsAgo } })
      .sort({ last_seen: -1 })
      .limit(100)
      .lean();

    const formatted = activeVisits.map((v) => ({
      id: v.visit_id,
      visitor_id: v.visitor_id,
      ip: v.ip_masked || "Unknown",
      location: v.location || "Unknown",
      device: `${v.device || "Desktop"} · ${v.browser || "Unknown"}`,
      onPage: v.current_page || "/",
      cameFrom: v.source || "Direct",
      pages: v.pages_viewed || 1,
      timeOnSite: v.time_on_site || 0,
      timeOnSiteFormatted: formatDuration(v.time_on_site || 0),
      lastSeen: v.last_seen,
      formSent: v.form_sent,
      applyClicked: v.apply_clicked,
    }));

    return res.json({
      onSiteNow: formatted.length,
      visits: formatted,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[liveweb/live]", err);
    return res.status(500).json({ error: "Failed to fetch live visits" });
  }
});

// 6.4 Visitors List
router.get("/visitors", async (req, res) => {
  try {
    const { start, end } = getFilterDates(req.query);
    const filter = { first_seen: { $gte: start, $lte: end } };

    if (req.query.city) {
      filter.city = new RegExp(`^${req.query.city}$`, "i");
    }
    if (req.query.source) {
      filter.source = req.query.source;
    }
    if (req.query.returning === "true") {
      filter.visit_count = { $gt: 1 };
    }
    if (req.query.formSent === "true") {
      filter.form_sent = true;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;

    const [total, docs] = await Promise.all([
      LiveVisit.countDocuments(filter),
      LiveVisit.find(filter).sort({ first_seen: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const visits = docs.map((v) => ({
      id: v.visit_id,
      visitor_id: v.visitor_id,
      ip: v.ip_masked || "Unknown",
      location: v.location || "Unknown",
      device: `${v.device || "Desktop"} · ${v.browser || "Unknown"}`,
      source: v.source || "Direct",
      firstPage: v.entry_page || "/",
      currentPage: v.current_page || "/",
      pages: v.pages_viewed || 1,
      timeOnSite: v.time_on_site || 0,
      timeOnSiteFormatted: formatDuration(v.time_on_site || 0),
      formSent: v.form_sent,
      applyClicked: v.apply_clicked,
      applyRole: v.apply_role || "",
      visitCount: v.visit_count || 1,
      isReturning: (v.visit_count || 1) > 1,
      firstSeen: v.first_seen,
      lastSeen: v.last_seen,
    }));

    return res.json({
      visits,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error("[liveweb/visitors]", err);
    return res.status(500).json({ error: "Failed to fetch visitors list" });
  }
});

// 6.4 Single Visit Timeline
router.get("/visit/:id", async (req, res) => {
  try {
    const visit = await LiveVisit.findOne({ visit_id: req.params.id }).lean();
    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istFirstSeen = new Date(new Date(visit.first_seen).getTime() + istOffset);

    const formattedTimeline = (visit.timeline || []).map((item) => {
      const itemIst = new Date(new Date(item.time).getTime() + istOffset);
      const timeStr = itemIst.toISOString().substring(11, 16); // HH:mm
      return {
        time: item.time,
        timeStr,
        page: item.page,
        type: item.type,
        role: item.meta?.role || "",
        timeOnPage: item.time_on_page || 0,
        timeOnPageFormatted: formatDuration(item.time_on_page || 0),
      };
    });

    return res.json({
      id: visit.visit_id,
      visitor_id: visit.visitor_id,
      ip: visit.ip_masked || "Unknown",
      location: visit.location || "Unknown",
      device: `${visit.device || "Desktop"} · ${visit.browser || "Unknown"}`,
      source: visit.source || "Direct",
      visitCount: visit.visit_count || 1,
      firstSeen: visit.first_seen,
      firstSeenFormatted: istFirstSeen.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }),
      timeOnSiteFormatted: formatDuration(visit.time_on_site || 0),
      timeline: formattedTimeline,
    });
  } catch (err) {
    console.error("[liveweb/visit/:id]", err);
    return res.status(500).json({ error: "Failed to fetch visit detail" });
  }
});

// 6.5 Pages
router.get("/pages", async (req, res) => {
  try {
    const { start, end } = getFilterDates(req.query);
    const visits = await LiveVisit.find({ first_seen: { $gte: start, $lte: end } }).lean();

    const pageStats = {};

    visits.forEach((v) => {
      (v.timeline || []).forEach((item) => {
        if (item.type === "pageview" && item.page) {
          if (!pageStats[item.page]) {
            pageStats[item.page] = {
              page: item.page,
              views: 0,
              visitors: new Set(),
              totalDuration: 0,
              durationCount: 0,
            };
          }
          pageStats[item.page].views += 1;
          pageStats[item.page].visitors.add(v.visitor_id);
          if (item.time_on_page > 0) {
            pageStats[item.page].totalDuration += item.time_on_page;
            pageStats[item.page].durationCount += 1;
          }
        }
      });
    });

    const pages = Object.values(pageStats)
      .map((p) => {
        const avgSecs = p.durationCount > 0 ? Math.round(p.totalDuration / p.durationCount) : 0;
        return {
          page: p.page,
          views: p.views,
          visitors: p.visitors.size,
          avgTimeOnPage: avgSecs,
          avgTimeOnPageFormatted: formatDuration(avgSecs),
        };
      })
      .sort((a, b) => b.views - a.views);

    return res.json({ pages });
  } catch (err) {
    console.error("[liveweb/pages]", err);
    return res.status(500).json({ error: "Failed to fetch pages stats" });
  }
});

// 6.6 Sources
router.get("/sources", async (req, res) => {
  try {
    const { start, end } = getFilterDates(req.query);
    const visits = await LiveVisit.find({ first_seen: { $gte: start, $lte: end } }).lean();

    const sourceStats = {};
    const defaultSources = ["LinkedIn", "Google", "Instagram", "Tally", "X", "Direct"];
    defaultSources.forEach((src) => {
      sourceStats[src] = {
        source: src,
        visitors: new Set(),
        totalVisits: 0,
        totalPages: 0,
        totalTime: 0,
        formsSent: 0,
        applyClicks: 0,
      };
    });

    visits.forEach((v) => {
      const src = v.source || "Direct";
      if (!sourceStats[src]) {
        sourceStats[src] = {
          source: src,
          visitors: new Set(),
          totalVisits: 0,
          totalPages: 0,
          totalTime: 0,
          formsSent: 0,
          applyClicks: 0,
        };
      }
      sourceStats[src].visitors.add(v.visitor_id);
      sourceStats[src].totalVisits += 1;
      sourceStats[src].totalPages += v.pages_viewed || 1;
      sourceStats[src].totalTime += v.time_on_site || 0;
      if (v.form_sent) sourceStats[src].formsSent += 1;
      if (v.apply_clicked) sourceStats[src].applyClicks += 1;
    });

    const sources = Object.values(sourceStats)
      .map((s) => {
        const visitorCount = s.visitors.size;
        const pagesPerVisit = s.totalVisits > 0 ? (s.totalPages / s.totalVisits).toFixed(1) : "0.0";
        const avgTimeOnSite = s.totalVisits > 0 ? Math.round(s.totalTime / s.totalVisits) : 0;

        return {
          source: s.source,
          visitors: visitorCount,
          totalVisits: s.totalVisits,
          pagesPerVisit: parseFloat(pagesPerVisit),
          avgTimeOnSite,
          avgTimeOnSiteFormatted: formatDuration(avgTimeOnSite),
          formsSent: s.formsSent,
          applyClicks: s.applyClicks,
        };
      })
      .sort((a, b) => b.visitors - a.visitors);

    return res.json({ sources });
  } catch (err) {
    console.error("[liveweb/sources]", err);
    return res.status(500).json({ error: "Failed to fetch sources stats" });
  }
});

// CSV Export
router.get("/export", async (req, res) => {
  try {
    const { start, end } = getFilterDates(req.query);
    const view = req.query.view || "visitors";
    const dateStr = new Date().toISOString().slice(0, 10);

    if (view === "pages") {
      const visits = await LiveVisit.find({ first_seen: { $gte: start, $lte: end } }).lean();
      const pageStats = {};
      visits.forEach((v) => {
        (v.timeline || []).forEach((item) => {
          if (item.type === "pageview" && item.page) {
            if (!pageStats[item.page]) {
              pageStats[item.page] = { page: item.page, views: 0, visitors: new Set(), duration: 0, count: 0 };
            }
            pageStats[item.page].views += 1;
            pageStats[item.page].visitors.add(v.visitor_id);
            if (item.time_on_page > 0) {
              pageStats[item.page].duration += item.time_on_page;
              pageStats[item.page].count += 1;
            }
          }
        });
      });

      const header = ["Page", "Views", "Unique Visitors", "Avg Time on Page (seconds)"];
      const rows = Object.values(pageStats)
        .sort((a, b) => b.views - a.views)
        .map((p) => [
          sanitizeCsvField(p.page),
          sanitizeCsvField(p.views),
          sanitizeCsvField(p.visitors.size),
          sanitizeCsvField(p.count > 0 ? Math.round(p.duration / p.count) : 0),
        ]);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="liveweb-pages-${dateStr}.csv"`);
      return res.send([header.join(","), ...rows.map((r) => r.join(","))].join("\n"));
    }

    if (view === "sources") {
      const visits = await LiveVisit.find({ first_seen: { $gte: start, $lte: end } }).lean();
      const sourceStats = {};
      visits.forEach((v) => {
        const src = v.source || "Direct";
        if (!sourceStats[src]) {
          sourceStats[src] = { source: src, visitors: new Set(), visits: 0, pages: 0, time: 0, forms: 0, applies: 0 };
        }
        sourceStats[src].visitors.add(v.visitor_id);
        sourceStats[src].visits += 1;
        sourceStats[src].pages += v.pages_viewed || 1;
        sourceStats[src].time += v.time_on_site || 0;
        if (v.form_sent) sourceStats[src].forms += 1;
        if (v.apply_clicked) sourceStats[src].applies += 1;
      });

      const header = ["Source", "Visitors", "Pages / Visit", "Avg Time on Site (seconds)", "Forms Sent", "Apply Clicks"];
      const rows = Object.values(sourceStats)
        .sort((a, b) => b.visitors.size - a.visitors.size)
        .map((s) => [
          sanitizeCsvField(s.source),
          sanitizeCsvField(s.visitors.size),
          sanitizeCsvField(s.visits > 0 ? (s.pages / s.visits).toFixed(1) : "0.0"),
          sanitizeCsvField(s.visits > 0 ? Math.round(s.time / s.visits) : 0),
          sanitizeCsvField(s.forms),
          sanitizeCsvField(s.applies),
        ]);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="liveweb-sources-${dateStr}.csv"`);
      return res.send([header.join(","), ...rows.map((r) => r.join(","))].join("\n"));
    }

    // Default: visitors export
    const visits = await LiveVisit.find({ first_seen: { $gte: start, $lte: end } })
      .sort({ first_seen: -1 })
      .lean();

    const header = [
      "Visit ID",
      "Visitor ID",
      "IP (Masked)",
      "Location",
      "Device",
      "Browser",
      "Source",
      "First Page",
      "Current Page",
      "Pages Viewed",
      "Time on Site (seconds)",
      "Form Sent",
      "Apply Clicked",
      "Visit Number",
      "Date (IST)",
    ];

    const rows = visits.map((v) => {
      const istDate = new Date(new Date(v.first_seen).getTime() + 5.5 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
      return [
        sanitizeCsvField(v.visit_id),
        sanitizeCsvField(v.visitor_id),
        sanitizeCsvField(v.ip_masked),
        sanitizeCsvField(v.location),
        sanitizeCsvField(v.device),
        sanitizeCsvField(v.browser),
        sanitizeCsvField(v.source),
        sanitizeCsvField(v.entry_page),
        sanitizeCsvField(v.current_page),
        sanitizeCsvField(v.pages_viewed),
        sanitizeCsvField(v.time_on_site),
        sanitizeCsvField(v.form_sent ? "Yes" : "No"),
        sanitizeCsvField(v.apply_clicked ? "Yes" : "No"),
        sanitizeCsvField(v.visit_count),
        sanitizeCsvField(istDate),
      ];
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="liveweb-visitors-${dateStr}.csv"`);
    return res.send([header.join(","), ...rows.map((r) => r.join(","))].join("\n"));
  } catch (err) {
    console.error("[liveweb/export]", err);
    return res.status(500).json({ error: "Failed to generate CSV export" });
  }
});

export default router;
