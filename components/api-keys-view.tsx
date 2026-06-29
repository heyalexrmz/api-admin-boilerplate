"use client"

import { useMemo, useState } from "react"
import { KeyRound } from "lucide-react"

import {
  API_KEY_SCOPES,
  ApiKeyScopeLabels,
  type ApiKey,
  type ApiKeyScope,
  type ApiKeyStatus,
} from "@/app/lib/definitions"
import { ApiKeysTable } from "@/components/api-keys-table"
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog"
import { DashboardHeaderAction } from "@/components/dashboard-header-actions"
import { EmptyState } from "@/components/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/filter-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQueryParams } from "@/lib/use-query-params"

type ApiKeyFilters = {
  query: string
  status: ApiKeyStatus | "all"
  scope: ApiKeyScope | "all"
}

const INITIAL_API_KEY_FILTERS: ApiKeyFilters = {
  query: "",
  status: "all",
  scope: "all",
}

const API_KEY_STATUS_OPTIONS: { value: ApiKeyStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
]

function parseApiKeyFilters(searchParams: URLSearchParams): ApiKeyFilters {
  const status = searchParams.get("status")
  const scope = searchParams.get("scope")

  return {
    query: searchParams.get("q") ?? "",
    status: API_KEY_STATUS_OPTIONS.some((option) => option.value === status)
      ? (status as ApiKeyStatus)
      : "all",
    scope: API_KEY_SCOPES.includes(scope as ApiKeyScope)
      ? (scope as ApiKeyScope)
      : "all",
  }
}

export function ApiKeysView({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const { searchParams, setQueryParams } = useQueryParams()
  const filters = useMemo(
    () => parseApiKeyFilters(new URLSearchParams(searchParams)),
    [searchParams]
  )

  const filteredKeys = useMemo(() => {
    const query = filters.query.trim().toLowerCase()

    return keys.filter((key) => {
      if (filters.status !== "all" && key.status !== filters.status) return false
      if (filters.scope !== "all" && !key.scopes.includes(filters.scope)) return false
      if (query) {
        const haystack = `${key.name} ${key.preview}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [filters, keys])

  const isFiltered =
    filters.query !== INITIAL_API_KEY_FILTERS.query ||
    filters.status !== INITIAL_API_KEY_FILTERS.status ||
    filters.scope !== INITIAL_API_KEY_FILTERS.scope

  function updateFilters(patch: Partial<ApiKeyFilters>) {
    const next = { ...filters, ...patch }
    setQueryParams({
      q: next.query === INITIAL_API_KEY_FILTERS.query ? null : next.query,
      status: next.status === INITIAL_API_KEY_FILTERS.status ? null : next.status,
      scope: next.scope === INITIAL_API_KEY_FILTERS.scope ? null : next.scope,
    })
  }

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
        <div className="flex flex-col gap-4">
          <FilterBar
            search={
              <FilterSearchInput
                value={filters.query}
                onChange={(q) => updateFilters({ query: q })}
                placeholder="Search key name or preview..."
                ariaLabel="Search API keys"
              />
            }
            resultCount={filteredKeys.length}
            totalCount={keys.length}
            resultLabel="keys"
            isFiltered={isFiltered}
            onClear={() => updateFilters(INITIAL_API_KEY_FILTERS)}
          >
            <div className="flex items-center gap-2">
              <Select
                value={filters.status}
                onValueChange={(status) =>
                  updateFilters({ status: status as ApiKeyFilters["status"] })
                }
              >
                <SelectTrigger className="w-36" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {API_KEY_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.scope}
                onValueChange={(scope) =>
                  updateFilters({ scope: scope as ApiKeyFilters["scope"] })
                }
              >
                <SelectTrigger className="w-36" aria-label="Filter by scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scopes</SelectItem>
                  {API_KEY_SCOPES.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {ApiKeyScopeLabels[scope]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FilterBar>

          <ApiKeysTable
            keys={filteredKeys}
            onRevoke={handleRevoke}
            onRename={handleRename}
            onRotate={handleRotate}
          />
        </div>
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
