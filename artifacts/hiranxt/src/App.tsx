import { Switch, Route, Router as WouterRouter } from "wouter";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/app/:rest*">
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
            <Route component={Dashboard} />
          </Switch>
        </AppLayout>
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
