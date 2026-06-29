"use client"

import { useState, useTransition } from "react"
import { Webhook as WebhookIcon } from "lucide-react"

import { sendTestEvent } from "@/app/actions/webhooks"
import type { UpdatedWebhook, Webhook } from "@/app/lib/definitions"
import { CreateWebhookDialog } from "@/components/webhooks/create-webhook-dialog"
import { WebhooksTable } from "@/components/webhooks/webhooks-table"
import { DashboardHeaderAction } from "@/components/dashboard-header-actions"
import { EmptyState } from "@/components/empty-state"
import { toast } from "@/lib/toast"

export function WebhooksView({ initialWebhooks }: { initialWebhooks: Webhook[] }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks)
  const [isPending, startTransition] = useTransition()

  function handleCreated(webhook: Webhook) {
    setWebhooks((prev) => [webhook, ...prev])
  }

  function handleUpdated(id: string, updated: UpdatedWebhook) {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              name: updated.name,
              url: updated.url,
              description: updated.description,
              events: updated.events,
            }
          : w
      )
    )
  }

  function handleRotated(id: string, preview: string, lastRotatedAt: string) {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, secretPreview: preview, lastRotatedAt } : w
      )
    )
  }

  function handleToggled(id: string, enabled: boolean) {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, enabled, status: enabled ? "active" : "disabled" } : w
      )
    )
  }

  function handleTestEvent(id: string) {
    if (isPending) return
    startTransition(async () => {
      const res = await sendTestEvent(id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      const { lastFiredAt, eventLog } = res
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, lastFiredAt } : w))
      )
      if (eventLog.status === "success") {
        toast.success("Test event delivered", {
          description: `Endpoint responded ${eventLog.httpStatus ?? "2xx"}.`,
        })
      } else {
        toast.error("Test event failed", {
          description: eventLog.httpStatus
            ? `Endpoint responded ${eventLog.httpStatus}.`
            : "Could not reach the endpoint.",
        })
      }
    })
  }

  function handleDeleted(id: string) {
    setWebhooks((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <>
      <DashboardHeaderAction>
        <CreateWebhookDialog onCreated={handleCreated} />
      </DashboardHeaderAction>

      {webhooks.length > 0 ? (
        <WebhooksTable
          webhooks={webhooks}
          onUpdated={handleUpdated}
          onRotated={handleRotated}
          onToggled={handleToggled}
          onTestEvent={handleTestEvent}
          onDeleted={handleDeleted}
        />
      ) : (
        <EmptyState
          icon={WebhookIcon}
          title="No webhooks"
          description="Send event payloads to an HTTPS endpoint you control. Subscribe to events and inspect delivery history per webhook."
        />
      )}
    </>
  )
}
