import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OverviewTab from "./OverviewTab";
import OpeningBalancesTab from "./OpeningBalancesTab";
import ChartOfAccountsTab from "./ChartOfAccountsTab";
import VouchersTab from "./VouchersTab";
import LedgersTab from "./LedgersTab";
import ReportsTab from "./ReportsTab";
import SettingsTab from "./SettingsTab";

export default function Accounting() {
  return (
    <div className="max-w-7xl">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="opening-balances">Opening Balances</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="vouchers">Journal Vouchers</TabsTrigger>
          <TabsTrigger value="ledgers">Ledgers &amp; Books</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="opening-balances">
          <OpeningBalancesTab />
        </TabsContent>
        <TabsContent value="accounts">
          <ChartOfAccountsTab />
        </TabsContent>
        <TabsContent value="vouchers">
          <VouchersTab />
        </TabsContent>
        <TabsContent value="ledgers">
          <LedgersTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
