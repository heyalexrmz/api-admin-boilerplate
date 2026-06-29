"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  KeyRound,
  Link2,
  ListChecks,
  LoaderCircle,
  RotateCw,
  Send,
} from "lucide-react"

import { sendTestEvent } from "@/app/actions/webhooks"
import {
  WebhookEventLabels,
  type UpdatedWebhook,
  type Webhook,
  type WebhookEvent,
  type WebhookEventLog,
} from "@/app/lib/definitions"
import { WebhookActions } from "@/components/webhooks/webhook-actions"
import { WebhookEventDetailsSheet } from "@/components/webhooks/webhook-event-details-sheet"
import { WebhookEventLogsTable } from "@/components/webhooks/webhook-event-logs-table"
import { WebhookStatusBadge } from "@/components/webhooks/webhook-status-badge"
import { CopyButton } from "@/components/copy-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import { toast } from "@/lib/toast"

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Link2
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="min-w-0 break-all text-sm">{children}</dd>
      </div>
    </div>
  )
}

export function WebhookDetailView({
  webhook: initialWebhook,
  initialEventLogs,
}: {
  webhook: Webhook
  initialEventLogs: WebhookEventLog[]
}) {
  const router = useRouter()
  const [webhook, setWebhook] = useState<Webhook>(initialWebhook)
  const [eventLogs, setEventLogs] = useState<WebhookEventLog[]>(initialEventLogs)
  const [selected, setSelected] = useState<WebhookEventLog | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleUpdated(id: string, updated: UpdatedWebhook) {
    setWebhook((w) =>
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
  }

  function handleRotated(id: string, preview: string, lastRotatedAt: string) {
    setWebhook((w) =>
      w.id === id ? { ...w, secretPreview: preview, lastRotatedAt } : w
    )
  }

  function handleToggled(id: string, enabled: boolean) {
    setWebhook((w) =>
      w.id === id
        ? { ...w, enabled, status: enabled ? "active" : "disabled" }
        : w
    )
  }

  function handleDeleted() {
    router.push("/dashboard/webhooks")
    router.refresh()
  }

  function handleSendTest(id: string) {
    if (isPending) return
    startTransition(async () => {
      const res = await sendTestEvent(id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      const { eventLog, lastFiredAt } = res
      setEventLogs((prev) => [eventLog, ...prev])
      setWebhook((w) => (w.id === id ? { ...w, lastFiredAt } : w))
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

  function handleRowClick(log: WebhookEventLog) {
    setSelected(log)
    setSheetOpen(true)
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
          <Link href="/dashboard/webhooks">
            <ArrowLeft />
            Webhooks
          </Link>
        </Button>
        <WebhookActions
          webhook={webhook}
          onUpdated={handleUpdated}
          onRotated={handleRotated}
          onToggled={handleToggled}
          onTestEvent={handleSendTest}
          onDeleted={handleDeleted}
        />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold tracking-tight">
              {webhook.name}
            </h3>
            <WebhookStatusBadge status={webhook.status} />
          </div>
          {webhook.description && (
            <p className="text-sm text-muted-foreground">
              {webhook.description}
            </p>
          )}
        </div>
        <Separator />
        <dl className="px-5">
          <InfoRow icon={Link2} label="Endpoint URL">
            <code className="font-mono text-sm">{webhook.url}</code>
            <CopyButton
              value={webhook.url}
              label="Endpoint URL"
              size="sm"
              className="mt-1.5 h-8"
            />
          </InfoRow>
          <InfoRow icon={ListChecks} label="Subscribed events">
            {webhook.events.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                No events subscribed
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {webhook.events.map((event) => (
                  <Badge key={event} variant="outline" className="text-xs">
                    {WebhookEventLabels[event as WebhookEvent] ?? event}
                  </Badge>
                ))}
              </div>
            )}
          </InfoRow>
          <InfoRow icon={KeyRound} label="Signing secret">
            <code className="font-mono text-sm">{webhook.secretPreview}</code>
            <p className="text-xs text-muted-foreground">
              The full secret is shown only once on creation or rotation.
            </p>
          </InfoRow>
          <InfoRow icon={CalendarPlus} label="Created">
            <span>{formatDateTime(webhook.createdAt)}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(webhook.createdAt)}
            </span>
          </InfoRow>
          <InfoRow icon={CalendarClock} label="Last delivery">
            {webhook.lastFiredAt ? (
              <>
                <span>{formatDateTime(webhook.lastFiredAt)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(webhook.lastFiredAt)}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Never</span>
            )}
          </InfoRow>
          <InfoRow icon={RotateCw} label="Last rotated">
            {webhook.lastRotatedAt ? (
              <>
                <span>{formatDateTime(webhook.lastRotatedAt)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(webhook.lastRotatedAt)}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Never</span>
            )}
          </InfoRow>
        </dl>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Event logs
          </h3>
          <p className="text-sm text-muted-foreground">
            Delivery history for this webhook.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 transition-transform active:scale-[0.96]"
          disabled={isPending}
          onClick={() => handleSendTest(webhook.id)}
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Send />
          )}
          Send test event
        </Button>
      </div>

      <div className="mt-3">
        <WebhookEventLogsTable
          eventLogs={eventLogs}
          onRowClick={handleRowClick}
        />
      </div>

      <WebhookEventDetailsSheet
        eventLog={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
