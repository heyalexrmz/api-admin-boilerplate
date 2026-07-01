import { ShieldCheck } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function NoAccessCard({
  title = "Se requiere acceso de administrador",
  description = "Necesitas rol de Admin o Propietario para ver esta página. Pide a un administrador que actualice tu rol.",
}: {
  title?: string
  description?: string
}) {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="justify-items-center text-center">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  )
}
