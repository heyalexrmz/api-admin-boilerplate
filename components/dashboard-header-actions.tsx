"use client"

import * as React from "react"

const DashboardHeaderActionsContext = React.createContext<
  (action: React.ReactNode) => void
>(() => {})

export function DashboardHeaderAction({ children }: { children: React.ReactNode }) {
  const setAction = React.useContext(DashboardHeaderActionsContext)

  React.useEffect(() => {
    setAction(children)
    return () => setAction(null)
  }, [children, setAction])

  return null
}

export { DashboardHeaderActionsContext }
