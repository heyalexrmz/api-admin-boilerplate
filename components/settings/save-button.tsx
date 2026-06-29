"use client"

import { useFormStatus } from "react-dom"
import { Check, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SaveButton({
  label = "Save changes",
  pendingLabel = "Saving…",
  variant = "default",
  disabled = false,
}: {
  label?: string
  pendingLabel?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      variant={variant}
      className="h-9 transition-transform active:scale-[0.96]"
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        <>
          <Check />
          {label}
        </>
      )}
    </Button>
  )
}
