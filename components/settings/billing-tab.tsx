import { CreditCard } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function BillingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>
          Plans, payment methods, and invoices for your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CreditCard className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">Billing isn&apos;t configured</p>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            Usage-based billing, payment methods, and invoices will appear here once
            billing is set up for your workspace.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
