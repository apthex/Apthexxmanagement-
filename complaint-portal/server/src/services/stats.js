import StatsMonthly from "../models/StatsMonthly.js";
import { monthKey } from "../utils/dates.js";
import { CATEGORIES } from "../models/Complaint.js";

const SAFE_CATEGORIES = new Set(CATEGORIES);

async function updateStats(institute_code, month, update, options = {}) {
  try {
    return await StatsMonthly.findOneAndUpdate({ institute_code, month }, update, {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: false,
      ...options,
    });
  } catch (error) {
    // Concurrent first-write of the same monthly row can race on the unique
    // index. The second write is a normal update.
    if (error?.code === 11000) {
      return StatsMonthly.findOneAndUpdate({ institute_code, month }, update, {
        returnDocument: "after",
        ...options,
      });
    }
    throw error;
  }
}

/**
 * Atomically maintain anonymised monthly counters. Deleting a complaint never
 * reverses these counters.
 */
export async function applyStatsDelta(
  institute_code,
  { received = 0, completed = 0, escalated = 0, category = null, categoryDelta = 0 } = {}
) {
  const month = monthKey();
  const inc = {};
  if (received) inc.received = received;
  if (completed) inc.completed = completed;
  if (escalated) inc.escalated = escalated;
  if (category && categoryDelta && SAFE_CATEGORIES.has(category)) {
    inc[`by_category.${category}`] = categoryDelta;
  }
  if (!Object.keys(inc).length) return null;
  // MongoDB creates the nested by_category object from the dotted $inc
  // paths. Adding a $setOnInsert for by_category here would make the update
  // conflict on the same path.
  return updateStats(institute_code, month, { $inc: inc });
}

export async function getInstituteTotals(institute_code, { fromMonth, toMonth } = {}) {
  const filter = { institute_code };
  if (fromMonth || toMonth) {
    filter.month = {};
    if (fromMonth) filter.month.$gte = fromMonth;
    if (toMonth) filter.month.$lte = toMonth;
  }
  const rows = await StatsMonthly.find(filter).sort({ month: 1 }).lean();
  const received = rows.reduce((sum, row) => sum + (row.received || 0), 0);
  const completed = rows.reduce((sum, row) => sum + (row.completed || 0), 0);
  const escalated = rows.reduce((sum, row) => sum + (row.escalated || 0), 0);
  return {
    received: Math.max(0, received),
    completed: Math.max(0, completed),
    escalated: Math.max(0, escalated),
    in_process: Math.max(0, received - completed),
    rows,
  };
}
