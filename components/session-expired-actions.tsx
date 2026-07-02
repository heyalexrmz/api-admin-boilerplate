"use client"

import Link from "next/link"
import { useEffect } from "react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SessionExpiredActions() {
  useEffect(() => {
    void authClient.signOut()
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <Button asChild size="lg" className="h-10 w-full">
        <Link href="/">Iniciar sesión de nuevo</Link>
      </Button>

      <Button asChild variant="outline" className="h-10 w-full">
        <Link href="/sso">Continuar con SSO</Link>
      </Button>
    </div>
  )
}
