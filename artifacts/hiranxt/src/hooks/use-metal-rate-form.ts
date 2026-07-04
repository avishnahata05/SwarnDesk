import { useEffect, useState } from "react";

type GoldKey = "gold22k" | "gold24k" | "gold18k";
const KARAT_OF: Record<GoldKey, number> = { gold22k: 22, gold24k: 24, gold18k: 18 };
const GOLD_KEYS: GoldKey[] = ["gold22k", "gold24k", "gold18k"];

export interface MetalRateFormValues {
  gold22k: string;
  gold24k: string;
  gold18k: string;
  silver: string;
}

interface CurrentRatesLike {
  gold22k: number;
  gold24k: number;
  gold18k: number;
  silver: number;
}

// Shared by every "edit today's rates" dialog (Settings, Billing quick-edit, ...) so all
// of them ask for the same four fields and derive the same way — previously some screens
// only asked for 22K + Silver, leaving 24K/18K silently stale after a 22K-only update.
//
// Gold rates are all quoted per 10g and are proportional to karat, so entering one karat's
// rate can auto-fill the other two. A field stops being auto-filled the moment the user
// types into it directly — after that it's an explicit override and won't be recalculated
// out from under them, even if they go back and change a different karat's rate.
export function useMetalRateForm(currentRates: CurrentRatesLike | undefined) {
  const [rateForm, setRateForm] = useState<MetalRateFormValues>({ gold22k: "", gold24k: "", gold18k: "", silver: "" });
  const [derivedGoldKeys, setDerivedGoldKeys] = useState<Set<GoldKey>>(new Set());

  useEffect(() => {
    if (!currentRates) return;
    setRateForm({
      gold22k: String(Math.round(currentRates.gold22k * 10)),
      gold24k: String(Math.round(currentRates.gold24k * 10)),
      gold18k: String(Math.round(currentRates.gold18k * 10)),
      silver: String(Math.round(currentRates.silver * 1000)),
    });
    setDerivedGoldKeys(new Set());
  }, [currentRates]);

  const setSilver = (raw: string) => setRateForm(f => ({ ...f, silver: raw }));

  const setGoldRate = (key: GoldKey, raw: string) => {
    const val = parseFloat(raw);
    const isValid = raw !== "" && isFinite(val) && val > 0;
    const others = GOLD_KEYS.filter(k => k !== key);

    setRateForm(f => {
      const next = { ...f, [key]: raw };
      if (isValid) {
        for (const other of others) {
          if (derivedGoldKeys.has(other) || !f[other]) {
            next[other] = String(Math.round(val * KARAT_OF[other] / KARAT_OF[key]));
          }
        }
      }
      return next;
    });

    setDerivedGoldKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      if (isValid) {
        for (const other of others) {
          if (prev.has(other) || !rateForm[other]) next.add(other);
        }
      }
      return next;
    });
  };

  // Converts the form's display units (₹/10g for gold, ₹/kg for silver) back to the
  // API's per-gram units, omitting any field the user left blank/invalid.
  const buildRatePayload = (): Record<string, number> => {
    const payload: Record<string, number> = {};
    const p22k = parseFloat(rateForm.gold22k);
    const p24k = parseFloat(rateForm.gold24k);
    const p18k = parseFloat(rateForm.gold18k);
    const pSilver = parseFloat(rateForm.silver);
    if (rateForm.gold22k && isFinite(p22k) && p22k > 0) payload.gold22k = p22k / 10;
    if (rateForm.gold24k && isFinite(p24k) && p24k > 0) payload.gold24k = p24k / 10;
    if (rateForm.gold18k && isFinite(p18k) && p18k > 0) payload.gold18k = p18k / 10;
    if (rateForm.silver && isFinite(pSilver) && pSilver > 0) payload.silver = pSilver / 1000;
    return payload;
  };

  return { rateForm, setGoldRate, setSilver, buildRatePayload };
}
