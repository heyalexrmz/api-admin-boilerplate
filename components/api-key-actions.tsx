"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, RefreshCw, ShieldOff } from "lucide-react"

import type { ApiKey } from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RenameApiKeyDialog } from "@/components/rename-api-key-dialog"
import { RevokeApiKeyDialog } from "@/components/revoke-api-key-dialog"
import { RotateApiKeyDialog } from "@/components/rotate-api-key-dialog"

export function ApiKeyActions({
  apiKey,
  onRevoke,
  onRename,
  onRotate,
}: {
  apiKey: ApiKey
  onRevoke: (id: string) => void
  onRename: (id: string, name: string) => void
  onRotate: (id: string, preview: string, lastRotatedAt: string) => void
}) {
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const isRevoked = apiKey.status === "revoked"

  if (isRevoked) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Acciones para ${apiKey.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil />
            Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRotateOpen(true)}>
            <RefreshCw />
            Rotar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setRevokeOpen(true)}
          >
            <ShieldOff />
            Revocar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameApiKeyDialog
        apiKey={apiKey}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onRenamed={onRename}
      />
      <RotateApiKeyDialog
        apiKey={apiKey}
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        onRotated={onRotate}
      />
      <RevokeApiKeyDialog
        apiKey={apiKey}
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        onRevoked={onRevoke}
      />
    </div>
  )
}
