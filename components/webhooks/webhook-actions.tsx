"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Power,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react"

import { toggleWebhook } from "@/app/actions/webhooks"
import type { UpdatedWebhook, Webhook } from "@/app/lib/definitions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteWebhookDialog } from "@/components/webhooks/delete-webhook-dialog"
import { EditWebhookDialog } from "@/components/webhooks/edit-webhook-dialog"
import { RotateWebhookDialog } from "@/components/webhooks/rotate-webhook-dialog"
import { toast } from "@/lib/toast"

export function WebhookActions({
  webhook,
  onUpdated,
  onRotated,
  onToggled,
  onTestEvent,
  onDeleted,
}: {
  webhook: Webhook
  onUpdated: (id: string, updated: UpdatedWebhook) => void
  onRotated: (id: string, preview: string, lastRotatedAt: string) => void
  onToggled: (id: string, enabled: boolean) => void
  onTestEvent: (id: string) => void
  onDeleted: (id: string) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    if (isPending) return
    startTransition(async () => {
      const res = await toggleWebhook(webhook.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onToggled(webhook.id, res.enabled)
      toast.success(res.enabled ? "Webhook enabled" : "Webhook disabled", {
        description: webhook.name,
      })
    })
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Actions for ${webhook.name}`}
            disabled={isPending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/webhooks/${webhook.id}`}>
              <ExternalLink />
              View events
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onTestEvent(webhook.id)}>
            <Send />
            Send test event
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRotateOpen(true)}>
            <RefreshCw />
            Rotate secret
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleToggle}>
            <Power />
            {webhook.enabled ? "Disable" : "Enable"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditWebhookDialog
        webhook={webhook}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={onUpdated}
      />
      <RotateWebhookDialog
        webhook={webhook}
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        onRotated={onRotated}
      />
      <DeleteWebhookDialog
        webhook={webhook}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
      />
    </div>
  )
}
