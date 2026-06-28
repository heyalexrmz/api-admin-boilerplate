"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"

import type { ApiKey } from "@/app/lib/definitions"
import { ApiKeysTable } from "@/components/api-keys-table"
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog"
import { DashboardHeaderAction } from "@/components/dashboard-header-actions"
import { EmptyState } from "@/components/empty-state"

export function ApiKeysView({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)

  function handleCreated(key: ApiKey) {
    setKeys((prev) => [key, ...prev])
  }

  function handleRevoke(id: string) {
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: "revoked" } : k))
    )
  }

  function handleRename(id: string, name: string) {
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, name } : k))
    )
  }

  function handleRotate(id: string, preview: string, lastRotatedAt: string) {
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, preview, lastRotatedAt } : k))
    )
  }

  return (
    <>
      <DashboardHeaderAction>
        <CreateApiKeyDialog onCreated={handleCreated} />
      </DashboardHeaderAction>

      {keys.length > 0 ? (
        <ApiKeysTable
          keys={keys}
          onRevoke={handleRevoke}
          onRename={handleRename}
          onRotate={handleRotate}
        />
      ) : (
        <EmptyState
          icon={KeyRound}
          title="No API keys"
          description="Create scoped keys for your applications and team members. Rotate keys anytime without downtime."
        />
      )}
    </>
  )
}
