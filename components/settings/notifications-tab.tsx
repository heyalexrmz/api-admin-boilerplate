import { Bell } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function NotificationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
        <CardDescription>
          Elige qué actualizaciones enviamos a tu correo y mostramos en el panel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">Aún no configurable</p>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            Las preferencias de notificaciones aparecerán aquí cuando estén disponibles
            para tu espacio de trabajo.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
