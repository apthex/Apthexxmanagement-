import Institute from "../models/Institute.js";
import StatsMonthly from "../models/StatsMonthly.js";
import { generateMonthlyPdf } from "./report.js";

export async function buildMonthlyReportData(instituteCode, month) {
  const [institute, row] = await Promise.all([
    Institute.findOne({ code: instituteCode }).select("code name type head_email status").lean(),
    StatsMonthly.findOne({ institute_code: instituteCode, month }).lean(),
  ]);
  const received = Math.max(0, row?.received || 0);
  const completed = Math.max(0, row?.completed || 0);
  return {
    institute,
    month,
    received,
    completed,
    inProcess: Math.max(0, received - completed),
    escalated: Math.max(0, row?.escalated || 0),
  };
}

export async function buildMonthlyReportPdf(instituteCode, month) {
  const data = await buildMonthlyReportData(instituteCode, month);
  const pdf = await generateMonthlyPdf({
    instituteName: data.institute?.name || instituteCode,
    month,
    received: data.received,
    completed: data.completed,
    inProcess: data.inProcess,
  });
  return { ...data, pdf };
}
