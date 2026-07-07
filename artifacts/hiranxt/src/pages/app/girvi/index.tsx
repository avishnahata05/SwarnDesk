import { useState, useEffect, useCallback } from "react";
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

  const loadBranches = useCallback(async () => {
    try {
      const r = await fetch(`${API}/branches`, { headers: authHeader() });
      if (r.ok) setBranches(await r.json());
    } catch { /* silent — LoansTab/NewLoanDialog fall back to a single implicit branch */ }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  return (
    <div className="max-w-7xl">
      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="loans">
          <LoansTab branches={branches} />
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
          <SettingsTab branches={branches} onBranchesChanged={loadBranches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
