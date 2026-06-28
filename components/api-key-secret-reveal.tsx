"use client"

import { useState } from "react"
import { Eye, EyeOff, ShieldAlert } from "lucide-react"

import { CopyButton } from "@/components/copy-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

function maskSecret(secret: string): string {
  return `sk_live_${"•".repeat(8)}${secret.slice(-4)}`
}

/**
 * One-time secret reveal shown after a key is created or rotated. The plaintext
 * is displayed with a show/hide toggle and a copy button; a hard warning reminds
 * the user the secret can't be recovered later.
 */
export function ApiKeySecretReveal({
  secret,
  onDone,
  doneLabel = "I've saved my key",
}: {
  secret: string
  onDone: () => void
  doneLabel?: string
}) {
  const [show, setShow] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <ShieldAlert />
        <AlertTitle>Copy your key now</AlertTitle>
        <AlertDescription>
          For security, the full key is shown only this once. We store a hashed
          copy, so it can&apos;t be recovered if you lose it.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-2">
        <div className="relative rounded-lg border border-input bg-muted/40 p-3">
          <code className="block break-all pr-10 font-mono text-sm leading-relaxed">
            {show ? secret : maskSecret(secret)}
          </code>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide key" : "Reveal key"}
            aria-pressed={show}
            className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {show
              ? "Visible — hide before sharing your screen."
              : "Hidden"}
          </span>
          <CopyButton
            value={secret}
            label="API key"
            onCopied={() => toast.success("API key copied to clipboard")}
          />
        </div>
      </div>

      <Button onClick={onDone} className="h-10 w-full">
        {doneLabel}
      </Button>
    </div>
  )
}
