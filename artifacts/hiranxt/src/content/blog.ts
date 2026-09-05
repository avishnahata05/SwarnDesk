// Blog content lives here as structured data rather than markdown so it renders
// with zero extra parsing dependencies and stays fully typed.

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "stats"; items: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; author: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; text: string }
  | { type: "faq"; items: { q: string; a: string }[] };

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description + card blurb, 140-160 chars. */
  description: string;
  keywords: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readTime: string;
  author: string;
  /** 40-60 word direct-answer opening, shown above the fold and used as the schema description. */
  directAnswer: string;
  blocks: Block[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "jewellery-erp-software-india-guide",
    title: "Jewellery ERP Software in India: What to Look for in 2026",
    description: "A jewellery ERP is billing, inventory, GST, accounting, and Girvi tracking in one system. Here's what separates a real jewellery ERP from a generic billing app.",
    keywords: "jewellery ERP software India, jewellery management software, gold shop software, jewellery billing software",
    category: "ERP Software",
    publishedAt: "2026-01-12",
    updatedAt: "2026-02-20",
    readTime: "7 min read",
    author: "SwarnDesk Team",
    directAnswer:
      "Jewellery ERP software is a single system that combines billing, inventory by weight and purity, GST return generation, full double entry accounting, and jewellery specific modules like Girvi (gold loan) and karigar tracking. It replaces the combination of a billing app, Tally, and paper registers most Indian jewellery shops still run on.",
    blocks: [
      { type: "p", text: "Jewellery ERP software is a single system that combines billing, inventory by weight and purity, GST return generation, full double entry accounting, and jewellery specific modules like Girvi (gold loan) and karigar tracking. It replaces the combination of a billing app, Tally, and paper registers most Indian jewellery shops still run on." },
      { type: "stats", items: [
        "Over 2,400 Indian jewellers now run their full billing and accounting on SwarnDesk.",
        "GST on gold jewellery in India is charged at 3% on the value of gold plus making charges, with an additional 5% GST on making charges when billed separately.",
        "HUID (Hallmark Unique Identification) has been mandatory for hallmarked gold jewellery sold in India since the phased BIS rollout began in 2021.",
      ] },
      { type: "h2", text: "What Is Jewellery ERP Software?", id: "what-is-jewellery-erp" },
      { type: "p", text: "Jewellery ERP (Enterprise Resource Planning) software is management software built specifically for how a jewellery shop actually operates: pricing by live gold and silver rates, tracking stock by weight and purity instead of just a unit count, recording HUID hallmark numbers per item, and handling jewellery-specific transactions like old gold exchange, karigar metal issue, and gold loan (Girvi) lending. A generic retail POS or accounting package can log a sale, but it has no concept of purity, wastage, or a pledge register." },
      { type: "p", text: "The distinction matters because a jewellery shop's real bottleneck usually isn't billing speed, it's the reconciliation between what the billing software says, what the accounts show, and what the karigar register or gold loan diary says. A true jewellery ERP removes that reconciliation step because every transaction posts to every relevant book automatically." },
      { type: "h2", text: "Core Modules a Real Jewellery ERP Should Have", id: "core-modules" },
      { type: "table", headers: ["Module", "What It Should Do"], rows: [
        ["Billing & POS", "Barcode or quick-add billing with live gold and silver rates, correct CGST/SGST or IGST split, and old gold exchange that updates inventory as physical stock."],
        ["Inventory", "Track every item by weight, purity, category, karigar, and HUID hallmark number, with barcode label printing and low stock alerts."],
        ["Accounting", "Full double entry books: every sale, purchase, loan, and karigar payment posts a balanced journal entry automatically, producing a live Trial Balance, P&L, and Balance Sheet."],
        ["GST Compliance", "GSTR-1 with a B2B/B2C split, a ready-to-file GSTR-3B with ITC netted off, HSN summary, and purchase/sales registers generated from real transactions."],
        ["Girvi / Gold Loan", "A standalone pawn lending ledger with sequential vouchers, interest and penalty tracking, and CA-facing reports like the pledge register."],
        ["Karigar Tracking", "Metal issued to and returned from each karigar, tracked to the gram, with a correction trail for wastage disputes."],
      ] },
      { type: "h2", text: "How Is a Jewellery ERP Different From Tally or a Generic Billing App?", id: "erp-vs-tally" },
      { type: "p", text: "Tally is general purpose accounting software. It can record a jewellery sale as a journal entry, but it has no native idea of gold purity, HUID tracking, karigar wastage, or a Girvi pledge register — all of that has to be built manually or tracked outside Tally, which is exactly why most shops end up running billing software and Tally side by side and reconciling the two by hand at month end." },
      { type: "p", text: "A generic billing app solves the opposite half of the problem: it bills fast but usually stops at the invoice. It won't auto-post a balanced double entry journal, generate a GSTR-3B, or track a karigar's outstanding gold balance. A jewellery ERP is built to do both halves in one system, so the books, the inventory, and the bill are always the same numbers." },
      { type: "h2", text: "Questions Jewellers Ask Before Switching", id: "faq" },
      { type: "faq", items: [
        { q: "Does jewellery ERP software replace Tally completely?", a: "Yes, if it includes full double entry accounting. SwarnDesk posts every sale, purchase, Girvi loan, repair, and karigar payment as a balanced journal entry automatically, generating a live Trial Balance, Profit & Loss, and Balance Sheet without a separate Tally file." },
        { q: "Is jewellery ERP software only for large showrooms?", a: "No. Because pricing is monthly and there is nothing to install, a single-counter shop gets the same billing, GST, and accounting tools as a multi-branch chain, just scaled to their transaction volume." },
        { q: "How long does it take to switch from a billing app to a jewellery ERP?", a: "Most shops go live within a day using a guided opening balance setup that imports existing cash, bank, and customer or supplier dues, then start billing on the new system immediately." },
      ] },
      { type: "callout", text: "SwarnDesk is jewellery ERP software built for Indian jewellers: billing, full double entry accounting, GST returns, Girvi gold loan tracking, and karigar management in one system, starting at ₹2,999/month with a 7 day free trial." },
    ],
  },
  {
    slug: "gstr1-gstr3b-jewellers-guide",
    title: "GST Returns for Jewellers: GSTR-1 and GSTR-3B Explained",
    description: "GSTR-1 reports every outward sale, GSTR-3B is the summary return you pay tax against. Here's exactly what a jewellery shop needs to file both correctly.",
    keywords: "jewellery GST software, GSTR-1 for jewellers, GSTR-3B jewellery shop, GST on gold jewellery, jewellery GST returns",
    category: "GST & Compliance",
    publishedAt: "2026-01-19",
    updatedAt: "2026-02-20",
    readTime: "6 min read",
    author: "SwarnDesk Team",
    directAnswer:
      "GSTR-1 is the monthly or quarterly return where a jewellery shop reports every outward sale invoice, split between B2B (with buyer GSTIN) and B2C. GSTR-3B is the summary return, filed after GSTR-1, where the shop declares total tax liability, claims Input Tax Credit (ITC) on gold and making-charge purchases, and pays the net GST due.",
    blocks: [
      { type: "p", text: "GSTR-1 is the monthly or quarterly return where a jewellery shop reports every outward sale invoice, split between B2B (with buyer GSTIN) and B2C. GSTR-3B is the summary return, filed after GSTR-1, where the shop declares total tax liability, claims Input Tax Credit (ITC) on gold and making-charge purchases, and pays the net GST due." },
      { type: "stats", items: [
        "Gold jewellery sold in India attracts 3% GST on the value of gold and making charges combined, or 3% on gold plus 5% on making charges if billed as a separate line item.",
        "GSTR-1 is generally due on the 11th of the following month for monthly filers, and GSTR-3B is generally due on the 20th.",
        "An HSN summary and separate purchase/sales registers are required supporting documents most CAs ask for alongside the filed returns.",
      ] },
      { type: "h2", text: "What Goes Into GSTR-1 for a Jewellery Shop?", id: "gstr1" },
      { type: "p", text: "GSTR-1 requires every outward supply for the period, split by transaction type. For a jewellery shop that means every counter sale, every B2B sale with the buyer's GSTIN captured, the correct CGST/SGST split for an intra-state sale or IGST for an inter-state sale, and any sale returns or credit notes issued in the period." },
      { type: "ul", items: [
        "B2B invoices: full invoice-level detail with the buyer's GSTIN, since the buyer will claim ITC against it.",
        "B2C invoices: usually reported as a consolidated summary by rate and place of supply, not invoice by invoice.",
        "Credit and debit notes: for sale returns, price adjustments, or corrections.",
        "HSN-wise summary: gold jewellery items rolled up by HSN code and tax rate.",
      ] },
      { type: "h2", text: "What Goes Into GSTR-3B?", id: "gstr3b" },
      { type: "p", text: "GSTR-3B is a summary return, not invoice-level. It declares total outward tax liability for the period (drawn from GSTR-1), total eligible Input Tax Credit on purchases like bullion and making charges paid to karigars or suppliers, and the net cash tax payable after ITC is set off. Filing it correctly depends entirely on the purchase side being recorded accurately, since that's where the ITC claim comes from." },
      { type: "h2", text: "Why Jewellery GST Filing Is Harder Than It Looks", id: "why-hard" },
      { type: "p", text: "The difficulty isn't the GST rate, it's reconciling three different tax treatments in one shop: gold jewellery at 3%, making charges sometimes billed separately at 5%, and old gold exchange where the shop is both buying used gold from a customer and selling new jewellery in the same transaction. Doing this by hand or exporting data from a generic billing app into a spreadsheet is where most filing errors happen." },
      { type: "table", headers: ["Manual Process", "With Jewellery GST Software"], rows: [
        ["Export sales data, rebuild B2B/B2C split by hand", "GSTR-1 with B2B/B2C split generated directly from real invoices"],
        ["Reconcile purchase invoices separately for ITC", "Purchase GST and ITC tracked automatically against bullion dealer invoices"],
        ["Build HSN summary manually from item categories", "HSN-wise tax rollup generated automatically"],
        ["Hope the numbers match what was actually billed", "GSTR-3B is a direct summary of the same transactions used for GSTR-1"],
      ] },
      { type: "h2", text: "Frequently Asked Questions", id: "faq" },
      { type: "faq", items: [
        { q: "What GST rate applies to gold jewellery in India?", a: "Gold jewellery attracts 3% GST on the combined value of gold and making charges, or 3% on gold plus 5% on making charges if the making charge is billed as a separate line item on the invoice." },
        { q: "Can a jewellery shop claim ITC on gold purchased from a bullion dealer?", a: "Yes. GST paid on bullion and making charges from registered suppliers can be claimed as Input Tax Credit and set off against outward tax liability in GSTR-3B." },
        { q: "Does old gold exchange affect GST filing?", a: "Yes. When a shop takes old gold in exchange on a sale, it needs to be recorded as inventory coming in while the new jewellery sale is recorded and taxed normally, so the two sides of the transaction don't get merged incorrectly in the return." },
      ] },
      { type: "callout", text: "SwarnDesk generates GSTR-1 with a B2B/B2C split, a ready-to-file GSTR-3B with ITC netted off, HSN summary, and GST-wise purchase and sales registers directly from your real transactions, no manual rebuilding required." },
    ],
  },
  {
    slug: "girvi-gold-loan-software-guide",
    title: "What Is Girvi? A Complete Guide to Gold Loan and Pawn Software",
    description: "Girvi is the traditional gold loan / pawn lending counter many Indian jewellers run alongside their shop. Here's how it works and what software should track.",
    keywords: "girvi software, gold loan software, pawn shop software India, girvi gold loan tracking, pledge register software",
    category: "Girvi & Gold Loans",
    publishedAt: "2026-01-26",
    updatedAt: "2026-02-20",
    readTime: "6 min read",
    author: "SwarnDesk Team",
    directAnswer:
      "Girvi is the traditional practice, common across Indian jewellery shops, of lending cash against gold or silver pledged as collateral, similar to a pawn loan. Girvi software is a dedicated module that manages the loan lifecycle: pledge intake, interest calculation, renewal, redemption, and forfeiture, with legally numbered vouchers and CA-facing reports.",
    blocks: [
      { type: "p", text: "Girvi is the traditional practice, common across Indian jewellery shops, of lending cash against gold or silver pledged as collateral, similar to a pawn loan. Girvi software is a dedicated module that manages the loan lifecycle: pledge intake, interest calculation, renewal, redemption, and forfeiture, with legally numbered vouchers and CA-facing reports." },
      { type: "stats", items: [
        "A Girvi counter is typically run as a business separate from jewellery sales, with its own customer base and voucher numbering.",
        "Interest on a Girvi loan is usually charged monthly, with a configurable grace period before penalty interest applies.",
        "Most Girvi disputes and audit questions trace back to a missing or inconsistent pledge register, which is the single most requested CA report for this business.",
      ] },
      { type: "h2", text: "How Does a Girvi (Gold Loan) Counter Work?", id: "how-girvi-works" },
      { type: "p", text: "A customer pledges gold or silver ornaments as security and receives a cash loan against an appraised value, usually a percentage of the metal's market worth. The shop charges interest, typically monthly, until the customer repays and redeems the pledge. If the loan isn't repaid or renewed within the agreed period plus any grace period, the pledge can be forfeited according to the terms disclosed at the time of lending." },
      { type: "ol", items: [
        "Pledge intake: gold or silver is weighed, appraised, and a loan amount is disbursed against a sequentially numbered voucher.",
        "Interest accrual: interest builds up, usually monthly, against the outstanding principal.",
        "Renewal or partial payment: the customer can pay interest to renew the pledge, or make a partial principal payment.",
        "Redemption: the customer repays principal and interest in full and collects the pledged item.",
        "Forfeiture: if the loan remains unpaid past the loan term and grace period, the pledge can be forfeited per the disclosed terms.",
      ] },
      { type: "h2", text: "What Girvi Software Actually Needs to Track", id: "what-to-track" },
      { type: "table", headers: ["Requirement", "Why It Matters"], rows: [
        ["Sequential, legally numbered vouchers", "Pawn lending is regulated; gaps or reused voucher numbers are a compliance red flag."],
        ["Interest and penalty with a grace period", "Interest needs to auto-split from principal on every collection, with configurable penalty rates after the grace period."],
        ["Backdated collection entries", "Real shop operations sometimes need to record a collection after the fact; the system needs a controlled way to do this without breaking the audit trail."],
        ["Pledge register", "The single most common CA-facing report: every active and closed pledge with dates, amounts, and status."],
        ["Aging analysis", "Shows how long pledges have been outstanding, which is what a CA or auditor checks first."],
        ["Cash compliance flags", "High-value cash transactions need to be flagged for TCS and Section 269ST awareness, separate from jewellery sale cash limits."],
      ] },
      { type: "h2", text: "Why Girvi Is Usually Tracked Separately From Jewellery Sales", id: "why-separate" },
      { type: "p", text: "Girvi is a lending business, not a retail sale, so it needs its own customer base, its own voucher sequence, and its own set of reports (pledge register, maturity tracking, returns register) that have nothing to do with a jewellery invoice. Software that bolts Girvi onto a generic billing app usually forces it through the same invoice numbering and customer records as retail sales, which breaks the legal sequencing pawn lending needs and makes CA reporting harder, not easier." },
      { type: "h2", text: "Frequently Asked Questions", id: "faq" },
      { type: "faq", items: [
        { q: "Is Girvi the same as a gold loan from a bank or NBFC?", a: "The mechanics are similar (cash against pledged gold), but Girvi as run by a jewellery shop is typically a smaller-scale, informal-to-semi-formal lending counter with its own voucher and interest system, distinct from a regulated bank or NBFC gold loan product." },
        { q: "Can a jewellery shop run Girvi and retail billing in the same software?", a: "Yes, if the software treats Girvi as a genuinely standalone module with its own customer base and voucher sequence rather than reusing the retail sale numbering, which is what SwarnDesk's Girvi module does." },
        { q: "What report does a CA usually ask for first on a Girvi book?", a: "The pledge register: a complete list of every active and closed pledge with dates, principal, interest, and current status, usually paired with an aging analysis of how long each pledge has been outstanding." },
      ] },
      { type: "callout", text: "SwarnDesk's Girvi module is a full standalone pawn lending system: its own customer base, legally sequential vouchers, interest and penalty tracking with a configurable grace period, and CA-facing reports like the pledge register and aging analysis." },
    ],
  },
  {
    slug: "huid-hallmarking-jewellers-guide",
    title: "HUID Hallmarking Rules for Jewellers: What You Need to Track",
    description: "HUID is the unique 6-digit alphanumeric code assigned to every piece of hallmarked gold jewellery in India. Here's what jewellers need to record and why.",
    keywords: "HUID tracking software, hallmarking rules jewellers, HUID hallmark number, BIS hallmarking India, jewellery inventory software",
    category: "Compliance",
    publishedAt: "2026-02-02",
    updatedAt: "2026-02-20",
    readTime: "5 min read",
    author: "SwarnDesk Team",
    directAnswer:
      "HUID (Hallmark Unique Identification) is a unique 6-digit alphanumeric code assigned by BIS to every individual piece of hallmarked gold jewellery in India. Since the rollout that began in 2021, hallmarked gold jewellery sold in India must carry an HUID, and jewellers are expected to record and be able to trace each item against its HUID.",
    blocks: [
      { type: "p", text: "HUID (Hallmark Unique Identification) is a unique 6-digit alphanumeric code assigned by BIS to every individual piece of hallmarked gold jewellery in India. Since the rollout that began in 2021, hallmarked gold jewellery sold in India must carry an HUID, and jewellers are expected to record and be able to trace each item against its HUID." },
      { type: "stats", items: [
        "Every hallmarked piece gets its own unique HUID; no two items, even identical designs, share the same code.",
        "The HUID rollout by BIS began in 2021 and expanded the number of jewellery categories and registered assaying centres covered over time.",
        "A missing or unrecorded HUID on inventory makes it far harder to prove provenance if a hallmark is ever questioned by a customer or an authority.",
      ] },
      { type: "h2", text: "What Exactly Does HUID Track?", id: "what-huid-tracks" },
      { type: "p", text: "HUID ties a specific physical piece of jewellery to a hallmarking record at a registered assaying and hallmarking centre: the purity grade, the jeweller's registration, and the centre that hallmarked it. It is not the same as a purity stamp alone; it is a traceable identifier that can be looked up independently of the shop that sold it." },
      { type: "h2", text: "What a Jewellery Shop Needs to Record Per Item", id: "what-to-record" },
      { type: "ul", items: [
        "HUID hallmark number, captured at the time of purchase or intake",
        "Weight and purity (e.g. 22K, 18K) alongside the HUID",
        "Category (ring, necklace, bangle, etc.) for inventory and barcode organisation",
        "A printable barcode label that links the shop floor item back to its HUID and weight",
        "Karigar or supplier the item came from, for traceability if a quality question arises",
      ] },
      { type: "h2", text: "Why This Belongs in Inventory Software, Not a Separate Register", id: "why-in-software" },
      { type: "p", text: "Tracking HUID in a separate notebook or spreadsheet, disconnected from the actual billing and inventory system, means the number that goes on the customer's invoice can drift from what's actually recorded against that physical item. When HUID is a field on the inventory record itself, it travels automatically from purchase, to barcode label, to the final sale invoice, with no separate step to keep in sync." },
      { type: "h2", text: "Frequently Asked Questions", id: "faq" },
      { type: "faq", items: [
        { q: "Is HUID the same as a purity or karat stamp?", a: "No. A purity stamp (like 22K or 18K) indicates gold content, while HUID is a unique 6-digit alphanumeric identifier assigned to that specific piece by BIS, traceable to the hallmarking centre and jeweller registration." },
        { q: "Does every gold item need an HUID?", a: "Hallmarked gold jewellery sold in India needs an HUID under the BIS hallmarking rules that were rolled out starting in 2021; jewellers should check current BIS category coverage for any specific item type they stock." },
        { q: "Can HUID tracking be added to existing inventory records?", a: "Yes. HUID is best treated as a standard field on every inventory item, alongside weight, purity, and category, so it's captured once at intake and reused on barcode labels and invoices automatically." },
      ] },
      { type: "callout", text: "Every inventory item in SwarnDesk can carry its HUID hallmark number, weight, purity, category, and a printable barcode label, so the number on the shelf matches the number on the invoice every time." },
    ],
  },
  {
    slug: "jewellery-billing-software-vs-tally",
    title: "Jewellery Billing Software vs Tally: Which Should You Use?",
    description: "Tally handles accounting, jewellery billing software handles the counter. Most shops end up needing both, or one system that does both jobs at once.",
    keywords: "jewellery billing software, jewellery accounting software, Tally for jewellers, gold shop management software",
    category: "ERP Software",
    publishedAt: "2026-02-09",
    updatedAt: "2026-02-20",
    readTime: "6 min read",
    author: "SwarnDesk Team",
    directAnswer:
      "Tally is general purpose double entry accounting software; jewellery billing software is built for counter sales, weight and purity based inventory, and GST calculated the way jewellery is actually taxed. Most jewellery shops run both side by side and reconcile them manually, which is the exact problem a combined jewellery ERP is built to remove.",
    blocks: [
      { type: "p", text: "Tally is general purpose double entry accounting software; jewellery billing software is built for counter sales, weight and purity based inventory, and GST calculated the way jewellery is actually taxed. Most jewellery shops run both side by side and reconcile them manually, which is the exact problem a combined jewellery ERP is built to remove." },
      { type: "stats", items: [
        "A typical jewellery shop running Tally alongside separate billing software spends hours each month re-entering sales data into the books by hand.",
        "GSTR-1 and GSTR-3B preparation can take a CA's team a full day or more when data has to be exported and rebuilt from a billing tool that doesn't post to accounting automatically.",
        "Jewellery ERP software that auto-posts every transaction removes that reconciliation step entirely, since billing and accounting are the same system.",
      ] },
      { type: "h2", text: "What Tally Does Well", id: "tally-strengths" },
      { type: "p", text: "Tally is a mature, widely trusted general ledger tool. It handles chart of accounts, journal vouchers, and standard financial statements reliably, and most CAs already know how to work with a Tally export. Its limitation for a jewellery shop isn't accounting quality, it's that it has no built-in concept of gold purity, HUID, karigar wastage, or a Girvi pledge register, so all of that has to be recorded elsewhere and reconciled back into Tally by hand." },
      { type: "h2", text: "What Jewellery Billing Software Does Well", id: "billing-strengths" },
      { type: "p", text: "Purpose-built jewellery billing software is fast at the counter: barcode scanning, live gold and silver rates, old gold exchange, and GST calculated correctly for gold plus making charges. Its typical limitation is the accounting side: many billing tools stop at the invoice and don't post a full double entry journal, so the shop still needs a separate system, usually Tally, to close the books every month." },
      { type: "table", headers: ["Need", "Tally Alone", "Billing Software Alone", "Combined Jewellery ERP"], rows: [
        ["Fast counter billing with GST", "No", "Yes", "Yes"],
        ["Weight & purity based inventory", "No", "Partial", "Yes"],
        ["Full double entry accounting, auto posted", "Manual entry", "No", "Yes"],
        ["GSTR-1 / GSTR-3B from real transactions", "No", "Partial", "Yes"],
        ["Girvi / gold loan tracking", "No", "No", "Yes"],
        ["Karigar wastage tracking", "No", "No", "Yes"],
      ] },
      { type: "h2", text: "So Which Should You Use?", id: "which-to-use" },
      { type: "p", text: "If billing and accounting are handled by two different people who reconcile monthly, running Tally alongside dedicated jewellery billing software can work, at the cost of that reconciliation time every month. If the goal is to remove the reconciliation step entirely, the shop needs software where every sale, purchase, Girvi loan, repair, and karigar payment posts a balanced double entry journal automatically, producing the same Trial Balance, P&L, and Balance Sheet a Tally file would, without maintaining Tally separately." },
      { type: "h2", text: "Frequently Asked Questions", id: "faq" },
      { type: "faq", items: [
        { q: "Can jewellery ERP software fully replace Tally?", a: "Yes, if it includes full double entry accounting with automatic posting. A system that posts every sale, purchase, and karigar transaction as a balanced journal entry can generate a live Trial Balance, P&L, and Balance Sheet without a separate Tally file." },
        { q: "Will my CA still be able to work with the reports?", a: "Yes. A jewellery ERP built for Indian compliance generates the same category of reports a CA already expects: Trial Balance, P&L, Balance Sheet, GSTR-1, GSTR-3B, and an HSN summary." },
        { q: "Is switching from Tally difficult?", a: "Most of the effort is a one-time opening balance setup: bringing in existing cash, bank balances, and customer or supplier dues. After that, every new transaction posts automatically going forward." },
      ] },
      { type: "callout", text: "SwarnDesk auto-posts every sale, purchase, loan, repair, and karigar payment to a full double entry ledger, giving you a live Trial Balance, P&L, and Balance Sheet without maintaining a separate Tally file." },
    ],
  },
  {
    slug: "karigar-metal-tracking-wastage",
    title: "Karigar Metal Tracking: How to Stop Wastage Disputes",
    description: "Wastage disputes with a karigar almost always come down to one thing: no real record of how much gold went out and how much came back. Here's how to fix that.",
    keywords: "karigar tracking software, karigar wastage, gold wastage tracking, jewellery workshop management",
    category: "Inventory & Karigars",
    publishedAt: "2026-02-16",
    updatedAt: "2026-02-20",
    readTime: "5 min read",
    author: "SwarnDesk Team",
    directAnswer:
      "Karigar metal tracking records exactly how much gold or silver is issued to a karigar (goldsmith) for a job and how much comes back as finished jewellery, so any wastage is a known, agreed number instead of a dispute. The fix for most wastage disagreements is a system that logs every gram issued and returned, with a correction trail if an entry was made in error.",
    blocks: [
      { type: "p", text: "Karigar metal tracking records exactly how much gold or silver is issued to a karigar (goldsmith) for a job and how much comes back as finished jewellery, so any wastage is a known, agreed number instead of a dispute. The fix for most wastage disagreements is a system that logs every gram issued and returned, with a correction trail if an entry was made in error." },
      { type: "stats", items: [
        "Wastage in goldsmithing (the difference between metal issued and metal returned as a finished piece) is a normal part of the process, but disputes happen when there's no agreed record of the starting and ending weight.",
        "A karigar relationship without a logged issue-and-return trail relies entirely on memory or a paper chit, which is the single biggest source of shop-vs-karigar disagreements.",
        "A correction trail (rather than editing the original entry) is what lets both sides trust the numbers even after a mistake is fixed.",
      ] },
      { type: "h2", text: "Why Wastage Disputes Happen", id: "why-disputes-happen" },
      { type: "p", text: "A karigar is given raw gold or an existing piece to rework, and returns a finished item that weighs less due to normal loss during cutting, polishing, and setting. That loss, the wastage, is expected. The dispute isn't usually about whether wastage happened, it's about how much: without a recorded starting weight and ending weight tied to a specific job, both the shop and the karigar are relying on memory, and memory disagrees." },
      { type: "h2", text: "What Proper Karigar Tracking Records", id: "what-to-record" },
      { type: "ol", items: [
        "Metal issued: exact weight and purity handed to the karigar for a specific job, logged at the time of issue.",
        "Job description: what's being made or repaired, so the issue ties to a specific expected output.",
        "Metal returned: exact weight of the finished piece when it comes back.",
        "Wastage calculated: the difference between issued and returned weight, computed automatically rather than estimated.",
        "Correction trail: if an entry needs fixing, the correction is logged as its own event rather than silently overwriting the original, so there's always an audit trail.",
      ] },
      { type: "h2", text: "Why This Needs to Live in the Same System as Inventory", id: "why-same-system" },
      { type: "p", text: "If karigar issue and return are tracked in a separate notebook from the shop's inventory system, the finished piece that comes back has to be manually re-entered into inventory, which is exactly where numbers drift. When karigar tracking and inventory are the same system, the returned item lands as real stock automatically, at the weight that was actually recorded coming back, with the wastage number already reconciled." },
      { type: "h2", text: "Frequently Asked Questions", id: "faq" },
      { type: "faq", items: [
        { q: "What counts as normal wastage for a karigar job?", a: "Normal wastage varies by the type of work (plain casting versus intricate setting) and is typically agreed between the shop and karigar as a percentage range; the goal of tracking software isn't to define that percentage but to record the actual issued and returned weight so any dispute is settled with real numbers." },
        { q: "What if a karigar entry was recorded incorrectly?", a: "It should be corrected with a new, logged correction entry rather than edited in place, so there's a visible trail showing what was changed and why, which protects both the shop and the karigar if the numbers are ever questioned." },
        { q: "Does karigar tracking need to be a separate module from inventory?", a: "It needs its own workflow (issue, job, return, wastage), but it should update the same inventory system automatically when metal comes back, rather than requiring a manual re-entry step." },
      ] },
      { type: "callout", text: "SwarnDesk logs every gram of metal issued to and returned from a karigar, calculates wastage automatically, and keeps a correction trail if an entry needs fixing, so disputes get settled with real numbers." },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(p => p.slug === slug);
}

export function getRelatedPosts(slug: string, count = 3): BlogPost[] {
  return BLOG_POSTS.filter(p => p.slug !== slug).slice(0, count);
}
