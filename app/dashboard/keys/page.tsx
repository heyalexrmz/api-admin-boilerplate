import { ApiKeysView } from "@/components/api-keys-view"
import { listApiKeys } from "@/app/actions/api-keys"

export const metadata = {
  title: "API Keys · Dashboard",
  description: "Manage API keys",
}

export default async function KeysPage() {
  const keys = await listApiKeys()
  return <ApiKeysView initialKeys={keys} />
}
