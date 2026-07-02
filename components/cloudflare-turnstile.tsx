"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"

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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onErrorRef = useRef(onError)
  const didReceiveResetSignalRef = useRef(false)
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && !!window.turnstile
  )

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
    onErrorRef.current = onError
  }, [onError, onExpire, onVerify])

  useEffect(() => {
    if (!scriptReady || !window.turnstile || !containerRef.current || widgetIdRef.current) {
      return
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => onVerifyRef.current(token),
      "expired-callback": () => onExpireRef.current(),
      "error-callback": () => onErrorRef.current(),
    })

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, scriptReady, siteKey])

  useEffect(() => {
    if (resetSignal === undefined || !widgetIdRef.current || !window.turnstile) {
      return
    }
    if (!didReceiveResetSignalRef.current) {
      didReceiveResetSignalRef.current = true
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
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  )
}
