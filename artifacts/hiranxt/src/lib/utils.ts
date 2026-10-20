import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Pulls the server's own explanation ("Insufficient stock for X…", "This barcode is already
// used…") out of a failed API call, so the user sees what to fix instead of "Failed".
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: unknown } } | null)?.data;
  if (data && typeof data.error === "string" && data.error) return data.error;
  return fallback;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatWeight(grams: number): string {
  return `${grams.toFixed(3)}g`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr));
}
