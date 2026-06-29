import { cn } from "@/lib/utils"
import {
  OrganizationRoleLabels,
  type OrganizationRole,
} from "@/app/lib/definitions"
import { Badge } from "@/components/ui/badge"

const ROLE_VARIANT: Record<
  OrganizationRole,
  "default" | "secondary" | "outline"
> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
}

export function RoleBadge({
  role,
  className,
}: {
  role: OrganizationRole
  className?: string
}) {
  return (
    <Badge variant={ROLE_VARIANT[role]} className={cn(className)}>
      {OrganizationRoleLabels[role]}
    </Badge>
  )
}
