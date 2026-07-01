"use client"

import { useId, useState, useTransition } from "react"
import { LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react"

import { rotateApiKey } from "@/app/actions/api-keys"
import type { ApiKey, RotatedApiKey } from "@/app/lib/definitions"
import { ApiKeySecretReveal } from "@/components/api-key-secret-reveal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"

export function RotateApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
  onRotated,
}: {
  apiKey: ApiKey
  open: boolean
  onOpenChange: (open: boolean) => void
  onRotated: (id: string, preview: string, lastRotatedAt: string) => void
}) {
  const [confirmText, setConfirmText] = useState("")
  const [rotated, setRotated] = useState<RotatedApiKey | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputId = useId()

  const matches = confirmText.trim() === apiKey.name

  function handleRotate() {
    if (!matches || isPending) return
    startTransition(async () => {
      const res = await rotateApiKey(apiKey.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onRotated(apiKey.id, res.key.preview, res.key.lastRotatedAt)
      setRotated(res.key)
      toast.success("Llave API rotada", {
        description: "El secreto anterior ya no funciona.",
      })
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setConfirmText("")
      setRotated(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {rotated ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="size-4" />
                </span>
                Llave API rotada
              </DialogTitle>
              <DialogDescription>
                El nuevo secreto para{" "}
                <span className="font-medium text-foreground">
                  {apiKey.name}
                </span>{" "}
                está listo. El anterior ya no es válido.
              </DialogDescription>
            </DialogHeader>

            <ApiKeySecretReveal
              secret={rotated.secret}
              onDone={() => onOpenChange(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="size-4" />
                </span>
                Rotar llave API
              </DialogTitle>
              <DialogDescription>
                Genera un nuevo secreto para{" "}
                <span className="font-medium text-foreground">
                  {apiKey.name}
                </span>
                . La llave conserva su nombre, permisos y expiración.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <ShieldAlert />
              <AlertTitle>Cualquier servicio que use el secreto anterior fallará</AlertTitle>
              <AlertDescription>
                La rotación es inmediata. Actualiza tus integraciones con el nuevo
                secreto después de copiarlo.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <Label htmlFor={inputId} className="select-text">
                Escribe{" "}
                <span className="font-medium text-foreground">
                  {apiKey.name}
                </span>{" "}
                para confirmar
              </Label>
              <Input
                id={inputId}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={apiKey.name}
                autoComplete="off"
                autoFocus
                className="h-10"
                disabled={isPending}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                onClick={handleRotate}
                disabled={!matches || isPending}
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Rotando…
                  </>
                ) : (
                  <>
                    <RefreshCw />
                    Rotar llave
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
