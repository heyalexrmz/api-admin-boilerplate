import { ApiKeysView } from "@/components/api-keys-view"
import { NoAccessCard } from "@/components/no-access-card"
import { listApiKeys } from "@/app/actions/api-keys"
import { getCanManageActiveOrg } from "@/app/lib/auth"

export const metadata = {
  title: "API Keys · Dashboard",
  description: "Manage API keys",
}

export default async function KeysPage() {
  const canManage = await getCanManageActiveOrg()
  if (!canManage) return <NoAccessCard />
  const keys = await listApiKeys()
  return <ApiKeysView initialKeys={keys} />
}
