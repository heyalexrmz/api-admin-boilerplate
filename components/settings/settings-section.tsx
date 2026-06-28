import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
  isDanger,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  isDanger?: boolean
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle
          className={cn(isDanger && "text-destructive")}
        >
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      {footer && <CardFooter className="justify-end gap-2">{footer}</CardFooter>}
    </Card>
  )
}
