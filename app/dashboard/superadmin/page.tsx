import {
  adjustOrganizationCredits,
  assignOrganizationPlan,
  listBillingPlans,
  listSuperadminBillingOrganizations,
} from "@/app/actions/billing"
import { requireSuperadmin } from "@/app/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "Not refilled yet"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export default async function SuperadminPage() {
  await requireSuperadmin()
  const [plans, organizations] = await Promise.all([
    listBillingPlans(),
    listSuperadminBillingOrganizations(),
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Superadmin</CardTitle>
          <CardDescription>
            Internal controls for organization plans and ticket credit balances.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Organizations</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {organizations.length}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Plans</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{plans.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Default plan</p>
            <p className="mt-2 text-lg font-medium">
              {plans.find((plan) => plan.isDefault)?.name ?? "None"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Organization Credits</CardTitle>
            <CardDescription>
              Current balances after any due lazy refills have been applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{org.name}</p>
                    <Badge variant="secondary">{org.plan.name}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{org.slug}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Next refill: {formatDate(org.credits.next_refill_at)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-64">
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-muted-foreground">Balance</p>
                    <p className="text-2xl font-semibold">{org.credits.balance}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-muted-foreground">Allowance</p>
                    <p className="text-2xl font-semibold">
                      {org.plan.ticket_credit_allowance}
                    </p>
                  </div>
                </div>
                <form
                  action={assignOrganizationPlan}
                  className="flex w-full flex-col gap-2 sm:w-72"
                >
                  <input type="hidden" name="organizationId" value={org.id} />
                  <select
                    name="planId"
                    defaultValue={org.plan.id}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-label={`Assign plan for ${org.name}`}
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.ticketCreditAllowance})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`reset-${org.id}`} name="resetBalance" />
                      <Label
                        htmlFor={`reset-${org.id}`}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Reset credits
                      </Label>
                    </div>
                    <Button type="submit" size="sm">
                      Update
                    </Button>
                  </div>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Plan</CardTitle>
              <CardDescription>
                Move an organization to a plan and optionally reset credits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={assignOrganizationPlan} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="assign-organization">Organization</Label>
                  <select
                    id="assign-organization"
                    name="organizationId"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Choose organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assign-plan">Plan</Label>
                  <select
                    id="assign-plan"
                    name="planId"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Choose plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.ticketCreditAllowance} credits)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="reset-balance" name="resetBalance" />
                  <Label htmlFor="reset-balance" className="text-sm font-normal">
                    Reset balance to plan allowance
                  </Label>
                </div>
                <Button type="submit" className="w-full">
                  Assign plan
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adjust Credits</CardTitle>
              <CardDescription>
                Add or subtract credits with an audit ledger entry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={adjustOrganizationCredits} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adjust-organization">Organization</Label>
                  <select
                    id="adjust-organization"
                    name="organizationId"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Choose organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit-delta">Credit adjustment</Label>
                  <Input
                    id="credit-delta"
                    name="delta"
                    type="number"
                    step="1"
                    placeholder="100 or -25"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit-reason">Reason</Label>
                  <Input
                    id="credit-reason"
                    name="reason"
                    placeholder="Support credit"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Adjust credits
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
