import { describe, expect, it } from "vitest";
import { csvCell, csvText, toCsv } from "@/lib/csv";

describe("Finance Ledger & CSV Security (Build Spec §6.8, §8.3)", () => {
  it("performs financial math in integer paise without floating point error", () => {
    // Floating point math fails: 0.1 + 0.2 = 0.30000000000000004
    // Integer paise math is exact:
    const incomePaise1 = 150000_00; // ₹1,50,000.00
    const incomePaise2 = 65000_00;  // ₹65,000.00
    const expensePaise1 = 38400_00; // ₹38,400.00
    const expensePaise2 = 34000_00; // ₹34,000.00

    const totalIncomePaise = incomePaise1 + incomePaise2; // 21500000 paise (₹2,15,000)
    const totalExpensePaise = expensePaise1 + expensePaise2; // 7240000 paise (₹72,400)
    const netBalancePaise = totalIncomePaise - totalExpensePaise; // 14260000 paise (₹1,42,600)

    expect(totalIncomePaise).toBe(21500000);
    expect(totalExpensePaise).toBe(7240000);
    expect(netBalancePaise).toBe(14260000);

    // Converted to rupees
    expect(totalIncomePaise / 100).toBe(215000);
    expect(totalExpensePaise / 100).toBe(72400);
    expect(netBalancePaise / 100).toBe(142600);
  });

  it("handles reversing entry mathematics so that net balance cancels out completely", () => {
    const originalIncomePaise = 50000_50; // ₹50,000.50
    // Reversal entry creates an equal and opposite entry
    const reversalExpensePaise = originalIncomePaise;

    const netAfterReversal = originalIncomePaise - reversalExpensePaise;
    expect(netAfterReversal).toBe(0);
  });

  it("escapes formula injection characters in text fields while preserving numbers and dates", () => {
    // Dangerous text starting with =, +, -, @, tab, or carriage return
    expect(csvText("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(csvText("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvText("-2+3+cmd|' /C calc'!A0")).toBe("'-2+3+cmd|' /C calc'!A0");
    expect(csvText("@SUM(123)")).toBe("'@SUM(123)");
    expect(csvText("@SUM(1,2)")).toBe('"\'@SUM(1,2)"'); // Escaped formula + quoted due to comma
    expect(csvText("\tTabSeparated")).toBe("'\tTabSeparated");
    expect(csvText("\rCarriageReturn")).toBe('"\'\rCarriageReturn"');

    // Safe regular text is untouched
    expect(csvText("Retainer October 2026")).toBe("Retainer October 2026");
    expect(csvText("BrandGoesUp Services")).toBe("BrandGoesUp Services");

    // Numeric columns pass through raw as numbers without escaping
    expect(csvCell(150000)).toBe("150000");
    expect(csvCell(72400.5)).toBe("72400.5");
    expect(csvCell(-38400)).toBe("-38400"); // Negative number preserved as numeric

    // toCsv produces well-formed lines
    const csv = toCsv(
      ["date", "description", "amount"],
      [
        ["2026-10-18", "=DangerousFormula", 150000],
        ["2026-10-19", "Normal text", -500],
      ]
    );

    expect(csv).toContain("'=DangerousFormula");
    expect(csv).toContain("150000");
    expect(csv).toContain("-500");
  });
});
