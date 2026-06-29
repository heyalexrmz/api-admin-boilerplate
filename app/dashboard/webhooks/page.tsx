import { WebhooksView } from "@/components/webhooks/webhooks-view"
import { NoAccessCard } from "@/components/no-access-card"
import { listWebhooks } from "@/app/actions/webhooks"
import { getCanManageActiveOrg } from "@/app/lib/auth"

export const metadata = {
  title: "Webhooks · Dashboard",
  description: "Manage webhooks",
}

export default async function WebhooksPage() {
  const canManage = await getCanManageActiveOrg()
  if (!canManage) return <NoAccessCard />
  const webhooks = await listWebhooks()
  return <WebhooksView initialWebhooks={webhooks} />
}
