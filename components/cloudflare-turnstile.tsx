"use client"

import Script from "next/script"
import { useEffect, useId, useRef, useState } from "react"

type TurnstileWidgetId = string

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string
          action?: string
          callback?: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: () => void
        }
      ) => TurnstileWidgetId
      reset: (widgetId?: TurnstileWidgetId) => void
      remove: (widgetId: TurnstileWidgetId) => void
    }
  }
}

export function CloudflareTurnstile({
  siteKey,
  action,
  onVerify,
  onExpire,
  onError,
  resetSignal,
}: {
  siteKey: string
  action?: string
  onVerify: (token: string) => void
  onExpire: () => void
  onError: () => void
  resetSignal?: number
}) {
  const fallbackId = useId()
  const containerId = `turnstile-${fallbackId.replace(/:/g, "")}`
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && !!window.turnstile
  )

  useEffect(() => {
    if (!scriptReady || !window.turnstile || widgetIdRef.current) return

    widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
      sitekey: siteKey,
      action,
      callback: onVerify,
      "expired-callback": onExpire,
      "error-callback": onError,
    })

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, containerId, onError, onExpire, onVerify, scriptReady, siteKey])

  useEffect(() => {
    if (resetSignal === undefined || !widgetIdRef.current || !window.turnstile) {
      return
    }

    window.turnstile.reset(widgetIdRef.current)
  }, [resetSignal])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div id={containerId} className="min-h-[65px]" />
    </>
  )
}
