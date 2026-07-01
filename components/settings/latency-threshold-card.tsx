"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle } from "lucide-react"

import { updateLatencyThresholds } from "@/app/actions/organization"
import type { LatencyThresholds } from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Guardando…
        </>
      ) : (
        "Guardar umbrales"
      )}
    </Button>
  )
}

export function LatencyThresholdCard({
  thresholds,
  canEdit,
}: {
  thresholds: LatencyThresholds
  canEdit: boolean
}) {
  const [state, action] = useActionState(updateLatencyThresholds, undefined)

  useEffect(() => {
    if (state?.success) toast.success("Umbrales de latencia actualizados")
  }, [state?.success])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Umbrales de latencia</CardTitle>
        <CardDescription>
          Configura los colores de advertencia y crítico para los registros.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="latency-warning">Milisegundos de advertencia</Label>
            <Input
              id="latency-warning"
              name="warningMs"
              type="number"
              min={1}
              defaultValue={thresholds.warningMs}
              disabled={!canEdit}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="latency-critical">Milisegundos críticos</Label>
            <Input
              id="latency-critical"
              name="criticalMs"
              type="number"
              min={1}
              defaultValue={thresholds.criticalMs}
              disabled={!canEdit}
            />
          </div>
          <SubmitButton disabled={!canEdit} />
          {!canEdit && (
            <p className="text-sm text-muted-foreground sm:col-span-3">
              Solo el propietario de la organización puede editar los umbrales de latencia.
            </p>
          )}
          {state?.message && (
            <p className="text-sm text-destructive sm:col-span-3">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
