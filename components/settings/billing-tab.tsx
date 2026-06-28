"use client"

import { CreditCard, Plus, Receipt, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SettingsSection } from "@/components/settings/settings-section"

export function BillingTab() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Current plan"
        description="You're on the Free plan. Upgrade for higher limits and priority support."
        footer={
          <>
            <Button variant="outline" className="h-9">
              Manage plan
            </Button>
            <Button className="h-9">
              <Sparkles />
              Upgrade to Pro
            </Button>
          </>
        }
      >
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">Free</span>
              <Badge variant="secondary">Current</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              1,000 requests/day · 1 project · Community support
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight">$0</div>
            <div className="text-xs text-muted-foreground">per month</div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Payment method"
        description="Add a card to enable paid plans and overage billing."
        footer={
          <Button variant="outline" className="h-9">
            <Plus />
            Add payment method
          </Button>
        }
      >
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <CreditCard className="size-5" />
          No payment method on file.
        </div>
      </SettingsSection>

      <SettingsSection
        title="Invoices"
        description="Usage-based summaries and invoices appear here once your APIs are live."
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <Receipt className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground">
            Invoices are generated at the end of each billing cycle.
          </p>
        </div>
      </SettingsSection>
    </div>
  )
}
