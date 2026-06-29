import { Bell } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function NotificationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Choose which updates we send to your inbox and the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">Not configurable yet</p>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            Notification preferences will appear here once they&apos;re available for your
            workspace.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
