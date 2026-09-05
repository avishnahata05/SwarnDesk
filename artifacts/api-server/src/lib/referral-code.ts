import crypto from "node:crypto";
import { db, partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Excludes 0/O/1/I so a code is safe to read aloud or hand-write without ambiguity.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "SD-";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 10;

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let body = "";
  for (let i = 0; i < CODE_LENGTH; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `${PREFIX}${body}`;
}

/** Generates a referral code unique against partnersTable, retrying on collision.
 * At 32^6 (~1 billion) combinations a collision is exceedingly unlikely, but this is
 * checked rather than assumed. Throws if MAX_ATTEMPTS is exhausted. */
export async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const [existing] = await db.select({ id: partnersTable.id }).from(partnersTable).where(eq(partnersTable.referralCode, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique referral code after multiple attempts");
}

/** Referral codes are compared case-insensitively everywhere — normalize before lookup. */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}
