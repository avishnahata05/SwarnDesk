export type Rates = { gold22k: number; gold24k: number; gold18k: number; silver: number };

export type Branch = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
};

export type Customer = {
  id: number;
  customerCode: string;
  name: string;
  fatherName: string | null;
  address: string | null;
  mobile: string;
  altMobile: string | null;
  email: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  pan: string | null;
  kycComplete: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerStatement = {
  customer: Omit<Customer, "customerCode" | "kycComplete" | "createdAt" | "updatedAt"> & { customerCode: string };
  summary: {
    totalLoans: number;
    activeLoans: number;
    outstandingPrincipal: number;
    outstandingInterest: number;
    totalOutstanding: number;
    totalBorrowedAllTime: number;
    totalInterestPaidAllTime: number;
  };
  loans: Loan[];
  payments: Payment[];
};

export type Payment = {
  id: number;
  loanId: number;
  loanNumber: string;
  customerName: string;
  amount: number;
  paymentType: string;
  paymentMode: string;
  referenceNumber: string | null;
  paymentDate: string;
  notes: string | null;
};

export type Loan = {
  id: number;
  loanNumber: string;
  branchId: number | null;
  customerId: number | null;
  customerName: string;
  customerMobile: string;
  fatherName: string | null;
  address: string | null;
  kycDocType: string | null;
  kycDocNumber: string | null;
  pan: string | null;
  itemDescription: string | null;
  metalType: string;
  purity: string;
  grossWeight: number;
  netWeight: number;
  estimatedValue: number;
  loanAmount: number;
  processingFee: number;
  principalPaid: number;
  currentPrincipal: number;
  interestRate: number;
  penaltyRate: number;
  interestPeriod: string;
  periodDays: number;
  dailyRate: number;
  startDate: string;
  dueDate: string;
  status: string;
  normalInterest: number;
  penaltyInterest: number;
  accruedInterest: number;
  totalInterestCollected: number;
  interestWaived: number;
  collectedSinceReset: number;
  outstandingInterest: number;
  totalDue: number;
  daysRemaining: number;
  isOverdue: boolean;
  overdueDaysRaw: number;
  graceDaysApplied: number;
  withinGracePeriod: boolean;
  redeemedDate: string | null;
  redeemedAmount: number | null;
  returnVoucherNumber: string | null;
  goldSaleValue: number | null;
  lossAmount: number | null;
  notes: string | null;
  createdAt: string;
};

export type LoanItem = {
  id: number;
  itemType: string;
  quantity: number;
  metalType: string;
  purity: string;
  grossWeight: number;
  netWeight: number;
  estimatedValue: number;
  notes: string | null;
  status: string;
  currentBranchId: number | null;
  returnedAt: string | null;
};

export type PartialRelease = {
  id: number;
  releaseNumber: string;
  releaseDate: string;
  itemsDescription: string | null;
  principalSettled: number;
  interestSettled: number;
  notes: string | null;
};

export type Transfer = {
  id: number;
  transferNumber: string;
  loanId: number;
  fromBranchId: number | null;
  toBranchId: number | null;
  fromCustomerId: number | null;
  toCustomerId: number | null;
  transferDate: string;
  reason: string | null;
  notes: string | null;
  returnedAt: string | null;
  returnVoucherNumber: string | null;
  returnNotes: string | null;
  isReturned: boolean;
  createdAt: string;
};

export type Summary = {
  totalActive: number;
  totalLent: number;
  totalInterestAccrued: number;
  totalInterestCollected: number;
  totalProcessingFees: number;
  overdueCount: number;
  dueSoonCount: number;
  totalLoss: number;
  totalLoans: number;
  totalGoldWeight: number;
  totalSilverWeight: number;
};

export type GirviSettings = {
  shopName: string;
  ownerName: string | null;
  licenseNumber: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  mobile: string | null;
  email: string | null;
  termsAndConditions: string | null;
  financialYearStartMonth: number;
  defaultInterestRate: number;
  defaultInterestPeriod: string;
  defaultPenaltyRate: number;
  defaultLoanDurationDays: number;
  cashTransactionLimit: number;
  overdueGraceDays: number;
  receiptPrefix: string;
  returnPrefix: string;
  transferPrefix: string;
  partialReleasePrefix: string;
  updatedAt: string;
};
