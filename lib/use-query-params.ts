"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type QueryValue = string | number | null | undefined

export function useQueryParams() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const setQueryParams = useCallback(
    (patch: Record<string, QueryValue>) => {
      const next = new URLSearchParams(searchParams)

      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key)
        } else {
          next.set(key, String(value))
        }
      }

      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return { searchParams, setQueryParams }
}
