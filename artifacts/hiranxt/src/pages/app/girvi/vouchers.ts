import type { Loan, LoanItem, Payment, Rates, GirviSettings, Transfer, Branch } from "./types";

function getLiveGirviRate(metalType: string, purity: string, rates: Rates): number {
  if (metalType === "silver") return rates.silver;
  if (purity === "24K") return rates.gold24k;
  if (purity === "18K") return rates.gold18k;
  if (purity === "14K") return Math.round(rates.gold18k * 14 / 18);
  return rates.gold22k;
}

export function computeLiveEstValue(
  loan: { metalType: string; purity: string; netWeight: number },
  items: LoanItem[] | undefined,
  rates: Rates | undefined,
): number | null {
  if (!rates) return null;
  if (items && items.length > 0) {
    return Math.round(items.reduce((s, it) => s + it.netWeight * getLiveGirviRate(it.metalType, it.purity, rates), 0));
  }
  return Math.round(loan.netWeight * getLiveGirviRate(loan.metalType, loan.purity, rates));
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function openWindow(html: string, width = 800, height = 700) {
  const w = window.open("", "_blank", `width=${width},height=${height}`);
  if (w) { w.document.write(html); w.document.close(); }
}

const printCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px;background:#fff}
.page{max-width:720px;margin:0 auto;padding:24px 20px}
.shop-header{text-align:center;border-bottom:3px double #1a3e6e;padding-bottom:12px;margin-bottom:14px}
.shop-name{font-size:20px;font-weight:800;color:#1a3e6e}
.shop-sub{font-size:11px;color:#555;margin-top:3px}
.doc-title{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#c0392b;text-align:center;margin:12px 0 8px;border:1px solid #c0392b;padding:6px;border-radius:4px}
.meta-row{display:flex;justify-content:space-between;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:12px;flex-wrap:wrap;gap:8px}
.meta-item{text-align:center}
.meta-label{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
.meta-value{font-weight:700;color:#1a3e6e;font-size:13px;margin-top:2px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.section{border:1px solid #dee2e6;border-radius:6px;padding:10px 12px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e9ecef}
.field{display:flex;justify-content:space-between;margin-bottom:4px}
.field-label{color:#777}
.field-value{font-weight:600;text-align:right;max-width:55%}
.amount-box{text-align:center;margin:14px 0;padding:10px;background:#f0fdf4;border:2px solid #16a34a;border-radius:8px}
.amount-label{font-size:10px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.amount-value{font-size:22px;font-weight:800;color:#15803d;margin-top:4px}
.terms{border:1px solid #dee2e6;border-radius:6px;padding:10px 12px;margin-bottom:14px}
.terms ol{padding-left:16px}
.terms li{margin-bottom:3px;color:#444;font-size:11px}
.sig-row{display:flex;justify-content:space-between;margin-top:20px}
.sig-box{text-align:center;width:45%}
.sig-line{border-top:1px solid #333;margin-bottom:4px}
.sig-label{font-size:10px;color:#666}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;border-top:1px dashed #ddd;padding-top:8px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.no-print{display:none!important}}
`;

function shopHeader(settings: GirviSettings | undefined, shopName: string, shopAddress: string, shopMobile: string) {
  const name = settings?.shopName || shopName;
  const address = settings?.address || shopAddress;
  const mobile = settings?.mobile || shopMobile;
  const licenseLine = settings?.licenseNumber ? ` · License #${settings.licenseNumber}` : "";
  const gstinLine = settings?.gstin ? ` · GSTIN: ${settings.gstin}` : "";
  return `<div class="shop-header">
    <div class="shop-name">${name}</div>
    <div class="shop-sub">${address}${mobile ? ` · ${mobile}` : ""}${licenseLine}${gstinLine}</div>
  </div>`;
}

// ─── Interest / renewal / penalty collection receipt ───────────────────────
export function printInterestReceipt(
  payment: Payment,
  loan: Loan,
  shopName: string,
  shopAddress: string,
  shopMobile: string,
  settings?: GirviSettings,
) {
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const typeLabel: Record<string, string> = { interest: "Interest Collection", renewal: "Loan Renewal", penalty: "Penalty Payment", waiver: "Interest Waived (No Payment)" };
  const modeLabel: Record<string, string> = { cash: "Cash", bank: "Bank Transfer", upi: "UPI", cheque: "Cheque" };
  const isWaiver = payment.paymentType === "waiver";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Receipt — ${payment.id}</title>
<style>${printCss}.page{max-width:360px}</style></head><body><div class="page">
<div class="no-print" style="text-align:right;margin-bottom:12px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:6px 16px;border-radius:4px;font-size:12px;cursor:pointer">🖨 Print</button>
</div>
${shopHeader(settings, shopName, shopAddress, shopMobile)}
<div class="doc-title">${typeLabel[payment.paymentType] ?? "Payment Receipt"}</div>
<div class="field"><span class="field-label">Receipt #</span><span class="field-value">RCT-${payment.id}</span></div>
<div class="field"><span class="field-label">Date</span><span class="field-value">${fmtD(payment.paymentDate)}</span></div>
<div class="field"><span class="field-label">Loan No.</span><span class="field-value">${loan.loanNumber}</span></div>
<div class="field"><span class="field-label">Customer</span><span class="field-value">${loan.customerName}</span></div>
<div class="field"><span class="field-label">Mobile</span><span class="field-value">${loan.customerMobile}</span></div>
${isWaiver ? "" : `<div class="field"><span class="field-label">Mode</span><span class="field-value">${modeLabel[payment.paymentMode] ?? payment.paymentMode}${payment.referenceNumber ? ` (${payment.referenceNumber})` : ""}</span></div>`}
<div class="field"><span class="field-label">Collateral</span><span class="field-value">${loan.metalType.toUpperCase()} ${loan.purity} · ${loan.grossWeight.toFixed(3)}g</span></div>
<div class="amount-box">
  <div class="amount-label">${typeLabel[payment.paymentType] ?? "Amount Received"}</div>
  <div class="amount-value">${fmt(payment.amount)}</div>
</div>
<div class="field"><span class="field-label">Principal (Remaining)</span><span class="field-value">${fmt(loan.currentPrincipal)}</span></div>
<div class="field"><span class="field-label">Total Collected So Far</span><span class="field-value">${fmt(loan.totalInterestCollected)}</span></div>
${payment.notes ? `<div style="margin-top:8px;padding:6px;background:#f8f9fa;border-radius:4px;font-size:11px;color:#555">Note: ${payment.notes}</div>` : ""}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised by ${settings?.shopName || shopName}</div></div>
</div>
<div class="footer">This is a computer-generated receipt. Powered by SwarnDesk Girvi.</div>
</div></body></html>`;

  openWindow(html, 420, 600);
}

// ─── Pledge voucher (Girvi Receipt Voucher) ────────────────────────────────
export function openGirviVoucher(
  loan: Loan, shopName: string, shopAddress: string, shopMobile: string,
  items?: LoanItem[], rates?: Rates, payments?: Payment[], settings?: GirviSettings, branchName?: string,
) {
  const periodDays = loan.interestPeriod === "daily" ? 1 : loan.interestPeriod === "weekly" ? 7 : loan.interestPeriod === "yearly" ? 365 : 30;
  const interest3m = Math.round(loan.loanAmount * (loan.interestRate / 100) * (90 / periodDays));
  const interest6m = Math.round(loan.loanAmount * (loan.interestRate / 100) * (180 / periodDays));
  const terms = settings?.termsAndConditions?.split("\n").filter(Boolean) ?? [
    `The pledged ${loan.metalType} ornament(s) will be safely kept by the shop until redemption.`,
    "The customer must present this original voucher at the time of redemption.",
    `Original KYC document (${loan.kycDocType ? loan.kycDocType.replace(/_/g, " ") : "ID proof"}) must be brought for redemption.`,
    "Interest will be charged from the start date until the date of redemption.",
    `If not redeemed by the due date (${fmtDate(loan.dueDate)}), the shop reserves the right to sell the pledged item.`,
    "Loan extension is available on request, subject to interest payment.",
    "The shop is not responsible for any damage due to fire, theft, or natural calamities.",
  ];

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Girvi Voucher — ${loan.loanNumber}</title>
<style>${printCss}</style></head><body><div class="page">
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">🖨️ Print Voucher</button>
</div>
${shopHeader(settings, shopName, shopAddress, shopMobile)}
<div class="doc-title">Girvi Voucher (Pawn Receipt)</div>
<div class="meta-row">
  <div class="meta-item"><div class="meta-label">Loan Number</div><div class="meta-value">${loan.loanNumber}</div></div>
  ${branchName ? `<div class="meta-item"><div class="meta-label">Branch</div><div class="meta-value">${branchName}</div></div>` : ""}
  <div class="meta-item"><div class="meta-label">Start Date</div><div class="meta-value">${fmtDate(loan.startDate)}</div></div>
  <div class="meta-item"><div class="meta-label">Due Date</div><div class="meta-value">${fmtDate(loan.dueDate)}</div></div>
  <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${loan.status.toUpperCase()}</div></div>
</div>
<div class="grid-2">
  <div class="section">
    <div class="section-title">Customer Details</div>
    <div class="field"><span class="field-label">Name</span><span class="field-value">${loan.customerName}</span></div>
    ${loan.fatherName ? `<div class="field"><span class="field-label">Father's Name</span><span class="field-value">${loan.fatherName}</span></div>` : ""}
    <div class="field"><span class="field-label">Mobile</span><span class="field-value">${loan.customerMobile}</span></div>
    ${loan.address ? `<div class="field"><span class="field-label">Address</span><span class="field-value" style="white-space:pre-line">${loan.address}</span></div>` : ""}
    ${loan.kycDocType ? `<div class="field"><span class="field-label">${loan.kycDocType.replace(/_/g, " ").toUpperCase()}</span><span class="field-value">${loan.kycDocNumber ?? "—"}</span></div>` : ""}
    ${loan.pan ? `<div class="field"><span class="field-label">PAN</span><span class="field-value">${loan.pan}</span></div>` : ""}
  </div>
  <div class="section">
    <div class="section-title">Collateral Details</div>
    <div class="field"><span class="field-label">Total Gross Wt</span><span class="field-value">${loan.grossWeight.toFixed(3)} g</span></div>
    <div class="field"><span class="field-label">Total Net Wt</span><span class="field-value">${loan.netWeight.toFixed(3)} g</span></div>
    <div class="field"><span class="field-label">Est. Value (at pledge)</span><span class="field-value">${fmt(loan.estimatedValue)}</span></div>
    ${rates ? `<div class="field"><span class="field-label">Live Market Value</span><span class="field-value" style="color:#15803d">${fmt(computeLiveEstValue(loan, items, rates) ?? loan.estimatedValue)}</span></div>` : ""}
    ${loan.itemDescription ? `<div class="field" style="margin-top:4px"><span class="field-label">Items</span><span class="field-value" style="max-width:65%;text-align:right;word-break:break-word;font-size:11px">${loan.itemDescription}</span></div>` : ""}
  </div>
</div>
${items && items.length > 0 ? `
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Pledged Items Breakdown</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#f8f9fa">
      <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #dee2e6">Item</th>
      <th style="text-align:center;padding:4px 6px;border-bottom:1px solid #dee2e6">Qty</th>
      <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #dee2e6">Metal / Purity</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Gross Wt</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Net Wt</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Est. Value</th>
    </tr></thead>
    <tbody>
      ${items.map(it => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:4px 6px;font-weight:600">${it.itemType}${it.notes ? ` <span style="font-weight:400;color:#888">(${it.notes})</span>` : ""}</td>
        <td style="padding:4px 6px;text-align:center">${it.quantity}</td>
        <td style="padding:4px 6px">${it.metalType === "silver" ? "Silver" : "Gold"} ${it.purity}</td>
        <td style="padding:4px 6px;text-align:right">${it.grossWeight.toFixed(3)} g</td>
        <td style="padding:4px 6px;text-align:right">${it.netWeight.toFixed(3)} g</td>
        <td style="padding:4px 6px;text-align:right">${fmt(it.estimatedValue)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Loan Terms</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    <div class="field" style="flex-direction:column;gap:2px"><span class="field-label">Principal Amount</span><span style="font-size:16px;font-weight:800;color:#1a3e6e">${fmt(loan.loanAmount)}</span></div>
    <div class="field" style="flex-direction:column;gap:2px"><span class="field-label">Interest Rate</span><span style="font-weight:700">${loan.interestRate}% per ${loan.interestPeriod}${loan.penaltyRate > 0 ? ` (+${loan.penaltyRate}% penalty if overdue)` : ""}</span></div>
    <div class="field" style="flex-direction:column;gap:2px"><span class="field-label">Duration</span><span style="font-weight:700">${Math.ceil((new Date(loan.dueDate).getTime() - new Date(loan.startDate).getTime()) / 86400000)} days</span></div>
  </div>
  ${loan.processingFee > 0 ? `<div class="field" style="margin-top:6px"><span class="field-label">Processing Fee</span><span class="field-value">${fmt(loan.processingFee)}</span></div>` : ""}
</div>
<table class="interest-table" style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px">
  <thead><tr><th style="background:#1a3e6e;color:#fff;padding:6px 10px;text-align:left">Period</th><th style="background:#1a3e6e;color:#fff;padding:6px 10px;text-align:left">Interest Accrued</th><th style="background:#1a3e6e;color:#fff;padding:6px 10px;text-align:left">Total Due</th></tr></thead>
  <tbody>
    <tr><td style="padding:5px 10px;border-bottom:1px solid #e9ecef">1 Month</td><td style="padding:5px 10px;border-bottom:1px solid #e9ecef">${fmt(Math.round(loan.loanAmount * (loan.interestRate / 100) * (30 / periodDays)))}</td><td style="padding:5px 10px;border-bottom:1px solid #e9ecef">${fmt(loan.loanAmount + Math.round(loan.loanAmount * (loan.interestRate / 100) * (30 / periodDays)))}</td></tr>
    <tr><td style="padding:5px 10px;border-bottom:1px solid #e9ecef">3 Months</td><td style="padding:5px 10px;border-bottom:1px solid #e9ecef">${fmt(interest3m)}</td><td style="padding:5px 10px;border-bottom:1px solid #e9ecef">${fmt(loan.loanAmount + interest3m)}</td></tr>
    <tr style="font-weight:700;background:#fff3cd"><td style="padding:5px 10px">6 Months (Due Date)</td><td style="padding:5px 10px">${fmt(interest6m)}</td><td style="padding:5px 10px">${fmt(loan.loanAmount + interest6m)}</td></tr>
  </tbody>
</table>
<div class="terms">
  <div class="section-title">Terms &amp; Conditions</div>
  <ol>${terms.map(t => `<li>${t}</li>`).join("")}</ol>
</div>
${loan.notes ? `<div style="font-size:11px;color:#666;margin-bottom:12px;padding:8px;background:#f8f9fa;border-radius:4px;border-left:3px solid #1a3e6e">Notes: ${loan.notes}</div>` : ""}
${payments && payments.length > 0 ? (() => {
    const typeLabel: Record<string, string> = { interest: "Byaj (Interest)", renewal: "Loan Renewal", penalty: "Penalty", principal: "Principal Repayment", waiver: "Interest Waived" };
    const totalCollected = payments.filter(p => p.paymentType !== "waiver").reduce((s, p) => s + p.amount, 0);
    let running = loan.loanAmount;
    const rows = payments.map(p => {
      if (p.paymentType === "principal") running -= p.amount;
      const isWaiver = p.paymentType === "waiver";
      return `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:5px 8px">${fmtDate(p.paymentDate)}</td>
        <td style="padding:5px 8px">${typeLabel[p.paymentType] ?? p.paymentType}</td>
        <td style="padding:5px 8px;text-align:right;color:${isWaiver ? "#2563eb" : "#15803d"};font-weight:600">${fmt(p.amount)}</td>
        <td style="padding:5px 8px;text-align:right">${fmt(running)}</td>
        <td style="padding:5px 8px;color:#666;font-style:italic;font-size:10px">${p.notes ?? ""}</td>
      </tr>`;
    });
    return `<div class="section" style="margin-bottom:12px">
  <div class="section-title">Payment History (${payments.length} record${payments.length !== 1 ? "s" : ""})</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#1a3e6e;color:#fff">
      <th style="padding:6px 8px;text-align:left;font-weight:600">Date</th>
      <th style="padding:6px 8px;text-align:left;font-weight:600">Type</th>
      <th style="padding:6px 8px;text-align:right;font-weight:600">Amount</th>
      <th style="padding:6px 8px;text-align:right;font-weight:600">Principal Balance</th>
      <th style="padding:6px 8px;text-align:left;font-weight:600">Notes</th>
    </tr></thead>
    <tbody>${rows.join("")}</tbody>
    <tfoot><tr style="background:#f0fdf4;font-weight:700">
      <td style="padding:6px 8px" colspan="2">Total Collected</td>
      <td style="padding:6px 8px;text-align:right;color:#15803d">${fmt(totalCollected)}</td>
      <td style="padding:6px 8px;text-align:right">${fmt(loan.currentPrincipal)}</td>
      <td style="padding:6px 8px"></td>
    </tr></tfoot>
  </table>
</div>`;
  })() : ""}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div><div style="font-size:10px;color:#999;margin-top:2px">${loan.customerName}</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised Signatory</div><div style="font-size:10px;color:#999;margin-top:2px">${settings?.shopName || shopName}</div></div>
</div>
<div class="footer">This is a computer-generated Girvi voucher. Powered by SwarnDesk Girvi.</div>
</div></body></html>`;

  openWindow(html);
}

// ─── Return voucher (redemption / forfeiture) ──────────────────────────────
export function openReturnVoucher(
  loan: Loan, shopName: string, shopAddress: string, shopMobile: string,
  payments?: Payment[], settings?: GirviSettings,
) {
  const isForfeit = loan.status === "forfeited";
  const relevantPayments = (payments ?? []).filter(p => p.paymentType !== "renewal");
  const interestSettled = relevantPayments.filter(p => p.paymentType === "interest" || p.paymentType === "penalty").reduce((s, p) => s + p.amount, 0);
  const principalSettled = relevantPayments.filter(p => p.paymentType === "principal").reduce((s, p) => s + p.amount, 0);
  const interestWaivedAtRedemption = relevantPayments.filter(p => p.paymentType === "waiver").reduce((s, p) => s + p.amount, 0);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Return Voucher — ${loan.returnVoucherNumber ?? loan.loanNumber}</title>
<style>${printCss}</style></head><body><div class="page">
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">🖨️ Print Voucher</button>
</div>
${shopHeader(settings, shopName, shopAddress, shopMobile)}
<div class="doc-title">${isForfeit ? "Forfeiture Voucher" : "Girvi Return Voucher"}</div>
<div class="meta-row">
  <div class="meta-item"><div class="meta-label">Return Voucher #</div><div class="meta-value">${loan.returnVoucherNumber ?? "—"}</div></div>
  <div class="meta-item"><div class="meta-label">Original Loan #</div><div class="meta-value">${loan.loanNumber}</div></div>
  <div class="meta-item"><div class="meta-label">${isForfeit ? "Forfeited On" : "Redeemed On"}</div><div class="meta-value">${loan.redeemedDate ? fmtDate(loan.redeemedDate) : "—"}</div></div>
</div>
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Customer</div>
  <div class="field"><span class="field-label">Name</span><span class="field-value">${loan.customerName}</span></div>
  <div class="field"><span class="field-label">Mobile</span><span class="field-value">${loan.customerMobile}</span></div>
  <div class="field"><span class="field-label">Collateral</span><span class="field-value">${loan.metalType.toUpperCase()} ${loan.purity} · ${loan.grossWeight.toFixed(3)}g</span></div>
  ${loan.itemDescription ? `<div class="field"><span class="field-label">Items</span><span class="field-value" style="max-width:60%">${loan.itemDescription}</span></div>` : ""}
</div>
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Settlement Breakdown</div>
  <div class="field"><span class="field-label">Original Principal</span><span class="field-value">${fmt(loan.loanAmount)}</span></div>
  <div class="field"><span class="field-label">Principal Settled</span><span class="field-value">${fmt(principalSettled || loan.loanAmount - (loan.currentPrincipal))}</span></div>
  <div class="field"><span class="field-label">Interest Settled</span><span class="field-value">${fmt(interestSettled)}</span></div>
  ${interestWaivedAtRedemption > 0 ? `<div class="field"><span class="field-label" style="color:#2563eb">Interest Waived</span><span class="field-value" style="color:#2563eb">${fmt(interestWaivedAtRedemption)}</span></div>` : ""}
  ${isForfeit ? `
  <div class="field"><span class="field-label">Sale Value of Gold</span><span class="field-value">${fmt(loan.goldSaleValue ?? 0)}</span></div>
  <div class="field"><span class="field-label" style="color:#c0392b">Net Loss</span><span class="field-value" style="color:#c0392b">${fmt(loan.lossAmount ?? 0)}</span></div>
  ` : ""}
</div>
<div class="amount-box">
  <div class="amount-label">${isForfeit ? "Total Recovered" : "Total Settled by Customer"}</div>
  <div class="amount-value">${fmt(loan.redeemedAmount ?? 0)}</div>
</div>
${!isForfeit ? `<div class="terms"><div class="section-title">Confirmation</div>
  <p style="font-size:11px;color:#444">The pledged item(s) listed above have been returned to the customer in full, and this loan is closed with no further amount outstanding.</p>
</div>` : `<div class="terms"><div class="section-title">Note</div>
  <p style="font-size:11px;color:#444">This loan was not redeemed by the due date. The pledged item(s) were forfeited and sold as per the terms agreed at pledge time.</p>
</div>`}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised by ${settings?.shopName || shopName}</div></div>
</div>
<div class="footer">This is a computer-generated return voucher. Powered by SwarnDesk Girvi.</div>
</div></body></html>`;

  openWindow(html, 720, 700);
}

// ─── Transfer voucher ───────────────────────────────────────────────────────
export function openTransferVoucher(
  transfer: Transfer, loan: Loan, items: LoanItem[], branches: Branch[],
  shopName: string, shopAddress: string, shopMobile: string, settings?: GirviSettings,
) {
  const branchName = (id: number | null) => branches.find(b => b.id === id)?.name ?? "—";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Transfer Voucher — ${transfer.transferNumber}</title>
<style>${printCss}</style></head><body><div class="page">
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">🖨️ Print Voucher</button>
</div>
${shopHeader(settings, shopName, shopAddress, shopMobile)}
<div class="doc-title">Girvi Transfer Voucher</div>
<div class="meta-row">
  <div class="meta-item"><div class="meta-label">Transfer #</div><div class="meta-value">${transfer.transferNumber}</div></div>
  <div class="meta-item"><div class="meta-label">Loan #</div><div class="meta-value">${loan.loanNumber}</div></div>
  <div class="meta-item"><div class="meta-label">Date</div><div class="meta-value">${fmtDate(transfer.transferDate)}</div></div>
</div>
<div class="grid-2">
  <div class="section"><div class="section-title">From</div><div class="field"><span class="field-label">Branch</span><span class="field-value">${branchName(transfer.fromBranchId)}</span></div></div>
  <div class="section"><div class="section-title">To</div><div class="field"><span class="field-label">Branch</span><span class="field-value">${transfer.toBranchId ? branchName(transfer.toBranchId) : "—"}</span></div></div>
</div>
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Customer</div>
  <div class="field"><span class="field-label">Name</span><span class="field-value">${loan.customerName}</span></div>
  <div class="field"><span class="field-label">Mobile</span><span class="field-value">${loan.customerMobile}</span></div>
</div>
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Items Transferred</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#f8f9fa">
      <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #dee2e6">Item</th>
      <th style="text-align:center;padding:4px 6px;border-bottom:1px solid #dee2e6">Qty</th>
      <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #dee2e6">Metal/Purity</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Gross Wt</th>
    </tr></thead>
    <tbody>${items.map(it => `<tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:4px 6px;font-weight:600">${it.itemType}</td>
      <td style="padding:4px 6px;text-align:center">${it.quantity}</td>
      <td style="padding:4px 6px">${it.metalType === "silver" ? "Silver" : "Gold"} ${it.purity}</td>
      <td style="padding:4px 6px;text-align:right">${it.grossWeight.toFixed(3)} g</td>
    </tr>`).join("")}</tbody>
  </table>
</div>
${transfer.reason ? `<div style="font-size:11px;color:#666;margin-bottom:12px;padding:8px;background:#f8f9fa;border-radius:4px;border-left:3px solid #1a3e6e">Reason: ${transfer.reason}</div>` : ""}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Dispatched By (${branchName(transfer.fromBranchId)})</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Received By (${transfer.toBranchId ? branchName(transfer.toBranchId) : "—"})</div></div>
</div>
<div class="footer">This is a computer-generated transfer voucher. Powered by SwarnDesk Girvi.</div>
</div></body></html>`;

  openWindow(html, 720, 700);
}
