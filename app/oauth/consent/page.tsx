import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { getSession } from "@/app/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { db } from "@/lib/db";
import { oauthClient } from "@/lib/db/schema";
import { mcpWorkspace } from "@/lib/mcp-workspace";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Autorizar acceso a Taxo Timbre", referrer: "no-referrer" };

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; redirect_uri?: string; sig?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const { client_id, redirect_uri, sig } = params;
  const activeOrganizationId = (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId;
  const workspace = session && await mcpWorkspace(session.user.id, activeOrganizationId);
  const [client] = typeof client_id === "string"
    ? await db.select({ name: oauthClient.name })
      .from(oauthClient).where(eq(oauthClient.clientId, client_id)).limit(1)
    : [];
  const destination = typeof redirect_uri === "string" ? URL.parse(redirect_uri) : null;
  const mayManage = workspace?.role === "owner" || workspace?.role === "admin";
  const valid = Boolean(session && client && destination && typeof sig === "string");

  return (
    <AuthShell>
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">Autorizar acceso a Taxo Timbre</h1>
        {valid ? (
          <>
            <p className="text-sm">
              <strong>{client?.name || "La aplicación solicitante"}</strong> ({destination?.host}) solicita conectar con Taxo Timbre.
            </p>
            {workspace ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p>Organización <strong>{workspace.name}</strong></p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Consultar tickets, facturas, documentos, disponibilidad y webhooks.</li>
                  {mayManage && <li>Consultar créditos y enviar tickets de prueba o para facturación. Cada envío nuevo en modo live puede consumir un crédito.</li>}
                </ul>
              </div>
            ) : <p className="text-sm">Necesitas pertenecer a una organización para autorizar el acceso.</p>}
            <ConsentForm organizationId={workspace?.organizationId} />
          </>
        ) : <p className="text-sm">Vuelve a iniciar la conexión en tu cliente MCP para continuar.</p>}
      </div>
    </AuthShell>
  );
}
