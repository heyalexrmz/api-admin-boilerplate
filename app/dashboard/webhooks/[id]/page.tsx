import { notFound } from "next/navigation"

import { getWebhook, listWebhookEvents } from "@/app/actions/webhooks"
import { getCanManageActiveOrg } from "@/app/lib/auth"
import { NoAccessCard } from "@/components/no-access-card"
import { WebhookDetailView } from "@/components/webhooks/webhook-detail-view"

export const metadata = {
  title: "Webhook · Dashboard",
  description: "Webhook details and event logs",
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const canManage = await getCanManageActiveOrg()
  if (!canManage) return <NoAccessCard />

  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const [webhook, eventLogs] = await Promise.all([
    getWebhook(id),
    listWebhookEvents(id),
  ])

  if (!webhook) notFound()

  return <WebhookDetailView webhook={webhook} initialEventLogs={eventLogs} />
}
