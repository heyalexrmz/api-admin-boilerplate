import { Building2 } from "lucide-react"

export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
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

      <aside className="relative hidden overflow-hidden lg:flex">
        <div
          aria-hidden="true"
          className="auth-scene absolute inset-0 bg-cover bg-center"
        />
      </aside>
    </div>
  )
}
