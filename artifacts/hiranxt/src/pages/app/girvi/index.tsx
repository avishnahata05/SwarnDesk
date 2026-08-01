import { useState, useEffect, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { API, authHeader } from "./api";
import type { Branch } from "./types";
import LoansTab from "./LoansTab";
import CustomersTab from "./CustomersTab";
import TransfersTab from "./TransfersTab";
import ReportsTab from "./ReportsTab";
import SettingsTab from "./SettingsTab";

export default function Girvi() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tab, setTab] = useState("loans");
  const [settingsDirty, setSettingsDirty] = useState(false);

  // SettingsTab reports unsaved changes here so we can confirm before letting
  // a tab switch discard them — Radix Tabs unmounts inactive content by
  // default, so without this an edit + accidental tab click just vanishes.
  const handleTabChange = (next: string) => {
    if (tab === "settings" && settingsDirty && next !== "settings") {
      if (!confirm("You have unsaved changes in Girvi Settings. Switch tabs anyway and discard them?")) return;
    }
    setTab(next);
  };

  // Supports a Dashboard quick action linking straight to "/app/girvi?new=1"
  // that auto-opens the New Loan dialog on the (default) Loans tab.
  const search = useSearch();
  const [, navigate] = useLocation();
  const autoOpenNew = new URLSearchParams(search).get("new") === "1";
  useEffect(() => {
    if (autoOpenNew) navigate("/app/girvi", { replace: true });
  }, [autoOpenNew, navigate]);

  const loadBranches = useCallback(async () => {
    try {
      const r = await fetch(`${API}/branches`, { headers: authHeader() });
      if (r.ok) setBranches(await r.json());
    } catch { /* silent — LoansTab/NewLoanDialog fall back to a single implicit branch */ }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  return (
    <div className="max-w-7xl">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="loans">
          <LoansTab branches={branches} autoOpenNew={autoOpenNew} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>
        <TabsContent value="transfers">
          <TransfersTab branches={branches} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab branches={branches} onBranchesChanged={loadBranches} onDirtyChange={setSettingsDirty} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
