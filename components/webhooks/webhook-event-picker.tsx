"use client"

import {
  WEBHOOK_EVENTS,
  WebhookEventLabels,
  type WebhookEvent,
} from "@/app/lib/definitions"
import { Checkbox } from "@/components/ui/checkbox"

export function WebhookEventPicker({
  selected,
  defaultSelected,
  onToggle,
}: {
  selected?: WebhookEvent[]
  defaultSelected?: WebhookEvent[]
  onToggle?: (event: WebhookEvent, checked: boolean) => void
}) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-input p-2">
      <div className="grid grid-cols-1 gap-2">
        {WEBHOOK_EVENTS.map((event) => {
          const checked = selected?.includes(event)
          const defaultChecked = defaultSelected?.includes(event)
          return (
            <label
              key={event}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm transition-colors has-checked:border-ring has-checked:bg-muted"
            >
              <Checkbox
                name="events"
                value={event}
                checked={selected ? checked : undefined}
                defaultChecked={selected ? undefined : defaultChecked}
                onCheckedChange={(value) => onToggle?.(event, value === true)}
              />
              {WebhookEventLabels[event]}
              <code className="ml-auto font-mono text-xs text-muted-foreground">
                {event}
              </code>
            </label>
          )
        })}
      </div>
    </div>
  )
}
