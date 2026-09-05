import { createContext, useContext, useState, type ReactNode } from "react";

export interface PartnerUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  referralCode: string;
  commissionPercent: number;
  status: "pending" | "active" | "inactive";
}

interface PartnerAuthContextType {
  partner: PartnerUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

const PartnerAuthContext = createContext<PartnerAuthContextType | null>(null);

const TOKEN_KEY = "swarndesk_partner_token";
const PARTNER_KEY = "swarndesk_partner";
// Owned by AuthContext — cleared here so logging in as a partner always signs out any
// shop-owner/staff/admin session in this browser (and vice versa). The two account
// types are mutually exclusive: only one is ever "the" logged-in session at a time.
const MAIN_TOKEN_KEY = "swarndesk_token";
const MAIN_USER_KEY = "swarndesk_user";

async function parseJsonOrThrow(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || fallback);
  return data;
}

export function PartnerAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [partner, setPartner] = useState<PartnerUser | null>(() => {
    const s = localStorage.getItem(PARTNER_KEY);
    return s ? JSON.parse(s) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const saveAuth = (newToken: string, newPartner: PartnerUser) => {
    localStorage.removeItem(MAIN_TOKEN_KEY);
    localStorage.removeItem(MAIN_USER_KEY);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(PARTNER_KEY, JSON.stringify(newPartner));
    setToken(newToken);
    setPartner(newPartner);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJsonOrThrow(res, "Login failed");
      saveAuth(data.token, data.partner);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (formData: { name: string; email: string; password: string; phone?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/partner/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      await parseJsonOrThrow(res, "Signup failed");
      // Signup never logs the partner in — a fresh signup starts "pending" and can't
      // fetch anything yet, so send them to the login page instead of minting a session.
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PARTNER_KEY);
    setToken(null);
    setPartner(null);
  };

  // Re-fetches the partner's own record — used by the dashboard to pick up a status
  // change (e.g. just got approved) without requiring a fresh login.
  const refresh = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) return;
    const res = await fetch("/api/partner/me", { headers: { Authorization: `Bearer ${currentToken}` } });
    if (!res.ok) {
      if (res.status === 401) logout();
      return;
    }
    const data = await res.json();
    localStorage.setItem(PARTNER_KEY, JSON.stringify(data));
    setPartner(data);
  };

  return (
    <PartnerAuthContext.Provider value={{ partner, token, login, signup, logout, refresh, isLoading }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}

export function usePartnerAuth() {
  const ctx = useContext(PartnerAuthContext);
  if (!ctx) throw new Error("usePartnerAuth must be used within PartnerAuthProvider");
  return ctx;
}
