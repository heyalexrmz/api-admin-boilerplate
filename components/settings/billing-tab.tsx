import { CreditCard } from "lucide-react"

import type { BillingOverview } from "@/app/actions/billing"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function formatDate(value: string | null) {
  if (!value) return "Aún no se recarga"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function BillingTab({
  billing,
  canManage,
}: {
  billing: BillingOverview | null
  canManage: boolean
}) {
  if (!canManage || !billing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facturación</CardTitle>
          <CardDescription>
            Planes y créditos de tickets para tu espacio de trabajo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Se requiere acceso de administrador</p>
            <p className="max-w-sm text-sm text-pretty text-muted-foreground">
              Pide al propietario o a un administrador que revise el plan y los créditos.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const allowance = billing.plan.ticket_credit_allowance
  const balance = billing.credits.balance
  const used = Math.max(allowance - balance, 0)
  const percent = allowance > 0 ? Math.min((balance / allowance) * 100, 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Facturación</CardTitle>
            <CardDescription>
              Planes y créditos de tickets para tu espacio de trabajo.
            </CardDescription>
          </div>
          <Badge variant="secondary">{billing.plan.name}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Créditos disponibles</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{balance}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Créditos del plan</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{allowance}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Frecuencia de recarga</p>
            <p className="mt-2 text-lg font-medium capitalize">
              {billing.plan.refill_frequency}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{used} créditos usados este periodo</span>
            <span className="font-medium">{Math.round(percent)}% restantes</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <p className="font-medium">Próxima recarga</p>
          <p className="mt-1 text-muted-foreground">
            Los créditos se restablecen a {allowance} el {formatDate(billing.credits.next_refill_at)}.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
