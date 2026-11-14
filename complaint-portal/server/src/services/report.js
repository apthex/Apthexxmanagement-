import PDFDocument from "pdfkit";
import { env } from "../config/env.js";
import { monthLabel } from "../utils/dates.js";

export function formatSmallCount(value) {
  const threshold = env.SMALL_NUMBER_THRESHOLD;
  const number = Math.max(0, Number(value) || 0);
  if (number === 0) return "0";
  if (number < threshold) return `Fewer than ${threshold}`;
  return String(number);
}

/**
 * One-page aggregate report. Deliberately excludes names, reference IDs,
 * category breakdowns, complaint descriptions and attachments.
 */
export function generateMonthlyPdf({ instituteName, month, received, completed, inProcess }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: "APTHEX Monthly Institute Report" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#111111").fontSize(22).text("APTHEX", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(15).fillColor("#333333").text("Monthly Complaint Report");
    doc.moveDown(1.4);

    doc.fontSize(11).fillColor("#555555").text("Institute");
    doc.fontSize(14).fillColor("#111111").text(instituteName || "Institute");
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor("#555555").text("Reporting month");
    doc.fontSize(14).fillColor("#111111").text(`${monthLabel(month)} (${month})`);
    doc.moveDown(1.6);

    doc.fontSize(12).fillColor("#111111").text("Case summary", { underline: true });
    doc.moveDown(0.8);
    doc.fontSize(12).fillColor("#111111").text(`Cases received: ${formatSmallCount(received)}`);
    doc.moveDown(0.5);
    doc.text(`Cases completed: ${formatSmallCount(completed)}`);
    doc.moveDown(0.5);
    doc.text(`Cases in process: ${formatSmallCount(inProcess)}`);
    doc.moveDown(2);

    doc.fontSize(9).fillColor("#666666").text(
      "This report contains aggregate counts only. It does not contain names, complaint descriptions, reference IDs, category breakdowns or attachments. Counts below five are reported as a range to protect reporter privacy.",
      { align: "left", lineGap: 2 }
    );
    doc.moveDown(1.2);
    doc.fontSize(9).fillColor("#666666").text(
      `APTHEX contact: ${env.APTHEX_CASE_MAILBOX || "contact not configured"}`
    );

    doc.end();
  });
}
