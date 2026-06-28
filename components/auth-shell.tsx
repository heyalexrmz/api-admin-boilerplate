import { Building2, Quote, ShieldCheck, Sparkles } from "lucide-react"

export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex">
        <div
          className="pointer-events-none absolute -top-40 -left-40 size-[28rem] rounded-full bg-orange-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-32 -bottom-32 size-[26rem] rounded-full bg-emerald-500/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
            <Sparkles className="size-4" />
          </span>
          Acme
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold text-balance">
            The operating system for high-velocity teams.
          </h1>
          <p className="mt-4 text-base text-pretty text-zinc-400">
            Plan, ship, and measure work across every department — without
            switching tabs. Trusted by 10,000+ fast-moving companies.
          </p>

          <figure className="mt-10 rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
            <Quote className="size-5 text-zinc-500" aria-hidden="true" />
            <blockquote className="mt-3 text-pretty text-base text-zinc-200">
              We cut onboarding time from two weeks to two days. Acme gave us one
              place to run the entire operation.
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 text-sm">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-yellow-400 to-emerald-500 font-medium text-white">
                MR
              </span>
              <span>
                <span className="block font-medium text-zinc-100">
                  Maya Rodriguez
                </span>
                <span className="block text-zinc-400">
                  VP Operations, Northwind
                </span>
              </span>
            </figcaption>
          </figure>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-zinc-400">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Security
            </dt>
            <dd className="mt-1 font-medium tabular-nums">SOC 2 Type II</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Teams</dt>
            <dd className="mt-1 font-medium tabular-nums">10,000+</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Uptime</dt>
            <dd className="mt-1 font-medium tabular-nums">99.99%</dd>
          </div>
        </dl>
      </aside>

      <main className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-base font-semibold tracking-tight lg:hidden">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <Building2 className="size-4" />
            </span>
            Acme
          </div>

          {children}

          <p className="mt-6 text-center text-xs text-pretty text-muted-foreground">
            {footer}
          </p>
        </div>
      </main>
    </div>
  )
}
