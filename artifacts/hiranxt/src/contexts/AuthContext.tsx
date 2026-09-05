import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAuthTokenGetter, customFetch, ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  shopName: string;
  role: string;
  plan: string;
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
  // Set only when a staff login (not the shop owner) is signed in.
  staffId: number | null;
  staffRole: string | null; // admin | accountant | salesperson
  // Which partner (if any) referred this shop in — null means organic/unattributed.
  // Used only to decide whether to show the referral-code field at checkout; carries
  // no partner-portal access of its own.
  partnerId: number | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; shopName: string; mobile?: string; referralCode?: string }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  // True only for the actual shop-owner login (not any staff role).
  isOwner: boolean;
  // Owner, or a staff login with the "admin" role — mirrors requireShopRole("admin") on
  // the backend. Gates Settings, Staff management, WhatsApp API config.
  isShopAdmin: boolean;
  // Owner, or a staff login with "admin"/"accountant" — mirrors
  // requireShopRole("admin","accountant"). Gates the whole Accounting module.
  canAccessAccounting: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "swarndesk_token";
const USER_KEY = "swarndesk_user";
// Owned by PartnerAuthContext — cleared here so a shop-owner/staff/admin login and a
// partner login are mutually exclusive in this browser: signing into one account type
// always signs you out of the other, rather than leaving both tokens sitting around.
const PARTNER_TOKEN_KEY = "swarndesk_partner_token";
const PARTNER_KEY = "swarndesk_partner";

// Registered at module load — i.e. before React even starts rendering — rather than inside
// AuthProvider's useEffect. React fires child effects before parent effects, so a query
// hook deep in the tree (e.g. useGetSettings on the very first render) would otherwise fire
// its initial fetch before this provider's own effect ever ran, sending every first-load
// request with no Authorization header (401, silently masked by TanStack Query's retry).
// Reading localStorage live on every call means it's always correct — no need to
// re-register it on login/logout/token-refresh.
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

function extractAuthErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    return data?.error || fallback;
  }
  // Backend returned an empty/non-JSON body — likely still starting up.
  return "Server is unreachable or still starting up. Please try again in a moment.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const s = localStorage.getItem(USER_KEY);
    return s ? JSON.parse(s) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Refresh user data from DB on startup to pick up plan changes (e.g. admin approved subscription)
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) return;
    customFetch<{ token: string; user: AuthUser }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((data) => {
        if (!data?.token || !data?.user) return;
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAuth = (newToken: string, newUser: AuthUser) => {
    localStorage.removeItem(PARTNER_TOKEN_KEY);
    localStorage.removeItem(PARTNER_KEY);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await customFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      saveAuth(data.token, data.user);
    } catch (err) {
      throw new Error(extractAuthErrorMessage(err, "Login failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData: { email: string; password: string; name: string; shopName: string; mobile?: string; referralCode?: string }) => {
    setIsLoading(true);
    try {
      const data = await customFetch<{ token: string; user: AuthUser }>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      saveAuth(data.token, data.user);
    } catch (err) {
      throw new Error(extractAuthErrorMessage(err, "Registration failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    queryClient.clear();
  };

  const isOwner = !!user && user.staffId === null;
  const isShopAdmin = isOwner || user?.staffRole === "admin";
  const canAccessAccounting = isOwner || user?.staffRole === "admin" || user?.staffRole === "accountant";

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading, isOwner, isShopAdmin, canAccessAccounting }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
