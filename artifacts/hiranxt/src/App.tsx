import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/app/dashboard";
import Inventory from "@/pages/app/inventory";
import Billing from "@/pages/app/billing";
import Customers from "@/pages/app/customers";
import Karigars from "@/pages/app/karigars";
import Repairs from "@/pages/app/repairs";
import Purchases from "@/pages/app/purchases";
import Reports from "@/pages/app/reports";
import Settings from "@/pages/app/settings";
import Girvi from "@/pages/app/girvi";
import Marketing from "@/pages/app/marketing";
import PendingPayments from "@/pages/app/pending-payments";
import CustomOrders from "@/pages/app/custom-orders";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import PaymentPage from "@/pages/auth/payment";
import AdminPage from "@/pages/admin/index";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/** Returns true if the user's access has actually expired based on real dates */
function isAccessExpired(user: { plan: string; trialEndsAt: string; subscriptionEndsAt: string | null }) {
  const now = new Date();
  if (user.plan === "expired") return true;
  if (user.plan === "trial" && new Date(user.trialEndsAt) < now) return true;
  if (user.plan === "active" && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) < now) return true;
  return false;
}

/** Wraps a component — redirects to /login if not authenticated, /payment if access expired */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin" && isAccessExpired(user)) return <Redirect to="/payment" />;

  return <>{children}</>;
}

/** Admin-only route */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/app/dashboard" />;

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/payment" component={PaymentPage} />
      <Route path="/admin">
        <AdminRoute>
          <AdminPage />
        </AdminRoute>
      </Route>
      <Route path="/app/:rest*">
        <ProtectedRoute>
          <AppLayout>
            <Switch>
              <Route path="/app/dashboard" component={Dashboard} />
              <Route path="/app/inventory" component={Inventory} />
              <Route path="/app/billing" component={Billing} />
              <Route path="/app/customers" component={Customers} />
              <Route path="/app/karigars" component={Karigars} />
              <Route path="/app/repairs" component={Repairs} />
              <Route path="/app/purchases" component={Purchases} />
              <Route path="/app/reports" component={Reports} />
              <Route path="/app/settings" component={Settings} />
              <Route path="/app/girvi" component={Girvi} />
              <Route path="/app/marketing" component={Marketing} />
              <Route path="/app/pending-payments" component={PendingPayments} />
              <Route path="/app/custom-orders" component={CustomOrders} />
              <Route component={Dashboard} />
            </Switch>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
