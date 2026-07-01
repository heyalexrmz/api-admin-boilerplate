"use client"

import { useFormStatus } from "react-dom"
import { ArrowRight, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

type SubmitButtonProps = {
  label?: string
  pendingLabel?: string
}

export function SubmitButton({
  label = "Iniciar sesión",
  pendingLabel = "Iniciando sesión…",
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-10 w-full transition-transform active:scale-[0.96]"
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRight />
        </>
      )}
    </Button>
  )
}
