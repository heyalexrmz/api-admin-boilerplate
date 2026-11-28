"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ConsentForm({ organizationId }: { organizationId?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function submit(accept: boolean) {
    setPending(true);
    setError(false);
    try {
      const { data } = await authClient.oauth2.consent({
        accept,
        fetchOptions: { headers: organizationId ? { "X-Taxo-Organization": organizationId } : {} },
      });
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
    } catch {
      // The same recovery applies to network errors and expired requests.
    }
    setError(true);
    setPending(false);
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">No pudimos continuar. Vuelve a iniciar la conexión en tu cliente MCP.</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => submit(false)}>Cancelar</Button>
        <Button type="button" disabled={pending || !organizationId} onClick={() => submit(true)}>Autorizar</Button>
      </div>
    </div>
  );
}
