import type { ReactElement } from "react"
import { toast as rht, Toaster } from "react-hot-toast"

export { Toaster }

type Opts = { description?: string }

function content(
  message: string,
  description?: string
): string | ReactElement {
  if (!description) return message
  return (
    <div className="flex flex-col">
      <span className="font-medium">{message}</span>
      <span className="text-xs opacity-75">{description}</span>
    </div>
  )
}

export const toast = {
  success: (message: string, opts?: Opts) =>
    rht.success(content(message, opts?.description)),
  error: (message: string, opts?: Opts) =>
    rht.error(content(message, opts?.description)),
}
