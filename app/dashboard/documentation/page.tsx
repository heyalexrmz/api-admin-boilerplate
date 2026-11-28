import { ChevronDown, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { productionMcpUrl } from "@/lib/mcp-config";
import openapi from "@/public/openapi/taxo-timbre.json";

export const metadata = {
  title: "Documentación · Taxo Timbre",
  description: "Referencia de la API de facturación y del servidor MCP de Taxo Timbre.",
};

type Schema = {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  enum?: string[];
  const?: unknown;
  default?: unknown;
  items?: Schema;
  anyOf?: Schema[];
  properties?: Record<string, Schema>;
  additionalProperties?: Schema;
  required?: string[];
};

type Media = { schema: Schema; example?: unknown };
type Parameter = { name: string; in: string; required: boolean; description: string; schema: Schema };
type Operation = {
  summary: string;
  description: string;
  tags: string[];
  deprecated?: boolean;
  "x-api-scope"?: string;
  parameters: (Parameter | { $ref: string })[];
  requestBody?: { content: Record<string, Media> };
  responses: Record<string, { description: string; content?: Record<string, Media> }>;
};

const operations: { path: string; method: string; operation: Operation }[] =
  Object.entries(openapi.paths).flatMap(([path, methods]) =>
    Object.entries(methods as Record<string, Operation>).map(([method, operation]) =>
      ({ path, method: method.toUpperCase(), operation })
    )
  );
const schemas: Record<string, Schema> = openapi.components.schemas;
const baseUrl = openapi.servers[0].url;
const groups = [
  { name: "Tickets", id: "tickets" },
  { name: "Servicio y consumo", id: "servicio" },
  { name: "Webhooks", id: "webhooks" },
];

const ticketExample = [
  `curl -X POST ${baseUrl}/api/v1/tickets \\`,
  '  -H "Authorization: Bearer $TAXO_API_KEY" \\',
  '  -H "Idempotency-Key: $TICKET_IDEMPOTENCY_KEY" \\',
  '  -F "tax_id=EKU9003173C9" \\',
  '  -F "taxpayer=EMPRESA DEMO" \\',
  '  -F "postal_code=01234" \\',
  '  -F "invoice_fiscal_regimen=601" \\',
  '  -F "invoice_cfdi_use=G03" \\',
  '  -F "file=@ticket.jpg" \\',
  '  -F "test_scenario=success"',
].join("\n");

const webhookExample = {
  id: "evt_ticket_failed_00000000-0000-4000-8000-000000000002",
  object: "event",
  api_version: openapi.info.version,
  type: "ticket.failed",
  created: "2026-07-01T18:23:00.000Z",
  livemode: true,
  data: {
    object: {
      object: "ticket",
      id: "00000000-0000-4000-8000-000000000001",
      status: "not_invoiceable",
      error: {
        code: "NOT_INVOICEABLE",
        type: "site",
        message: "El comercio indicó que este ticket no se puede facturar.",
        retryable: false,
      },
    },
  },
  request: {
    id: "00000000-0000-4000-8000-000000000001",
    idempotency_key: "ticket-demo-001",
  },
};

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}

function schemaLabel(schema: Schema): string {
  if (schema.$ref) return schema.$ref.split("/").at(-1)!;
  if (schema.anyOf) return schema.anyOf.map(schemaLabel).join(" | ");
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.join(" | ");
  if (schema.items) return `${schemaLabel(schema.items)}[]`;
  return schema.format ?? schema.type ?? "JSON";
}

function Fields({ fields }: { fields: { name: string; description?: string; schema: Schema; required?: boolean }[] }) {
  return (
    <dl className="divide-y rounded-lg border">
      {fields.map(({ name, description, schema, required }) => (
        <div key={name} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(11rem,1fr)_2fr]">
          <dt className="break-all font-mono text-xs">
            {name}
            {required && <span className="ml-2 font-sans text-muted-foreground">Requerido</span>}
          </dt>
          <dd className="min-w-0 space-y-1">
            <span className="block break-words font-mono text-xs text-muted-foreground">
              {schemaLabel(schema)}
              {schema.default !== undefined && ` · predeterminado: ${schema.default}`}
            </span>
            {description && <p>{description}</p>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SchemaFields({ schema }: { schema: Schema }) {
  const actual = schema.$ref ? schemas[schemaLabel(schema)] : schema;
  if (!actual?.properties) return <code className="text-xs">{schemaLabel(schema)}</code>;
  return <Fields fields={Object.entries(actual.properties).map(([name, field]) => ({
    name,
    schema: field,
    description: field.description,
    required: actual.required?.includes(name),
  }))} />;
}

function Endpoint({ path, method, operation }: (typeof operations)[number]) {
  const parameters = operation.parameters.map((parameter) => "$ref" in parameter
    ? openapi.components.parameters.RequestId
    : parameter);
  return (
    <details id={method.toLowerCase() + path.replace(/[^a-z0-9]+/g, "-")} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <Badge variant={method === "GET" ? "secondary" : "outline"}>{method}</Badge>
        <code className="min-w-0 break-all text-xs">{path}</code>
        <span className="text-sm font-medium">{operation.summary}</span>
        {operation.deprecated && <Badge variant="outline">Reservada</Badge>}
        <ChevronDown aria-hidden className="ml-auto size-4 text-muted-foreground group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t px-4 py-4">
        <p className="text-sm">{operation.description}</p>
        <p className="text-sm text-muted-foreground">
          {operation["x-api-scope"] ? `Alcance ${operation["x-api-scope"]}` : "Acceso por URL firmada"}
        </p>
        {parameters.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Parámetros</h3>
            <Fields fields={parameters.map((parameter) => ({
              ...parameter,
              name: `${parameter.name} (${parameter.in})`,
            }))} />
          </div>
        )}
        {Object.entries(operation.requestBody?.content ?? {}).map(([format, { schema, example }]) => (
          <div key={format} className="space-y-2">
            <h3 className="text-sm font-semibold">Cuerpo <code>{format}</code></h3>
            <SchemaFields schema={schema} />
            {example !== undefined && <CodeBlock code={JSON.stringify(example, null, 2)} />}
          </div>
        ))}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Respuestas</h3>
          <dl className="space-y-2">
            {Object.entries(operation.responses).map(([status, response]) => {
              const media = response.content?.["application/json"];
              return (
                <div key={status} className="space-y-2 rounded-md border px-3 py-2">
                  <div className="flex gap-2 text-sm">
                    <dt className="font-mono">{status}</dt>
                    <dd>{response.description}</dd>
                  </div>
                  {media && status.startsWith("2") && (
                    media.example === undefined
                      ? <SchemaFields schema={media.schema} />
                      : <CodeBlock code={JSON.stringify(media.example, null, 2)} />
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </details>
  );
}

export default function DocumentationPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="space-y-4 border-b pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Documentación de la API</h1>
          <p className="text-sm text-muted-foreground">Taxo Timbre · {openapi.info.version}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/openapi/taxo-timbre.json" download><Download /> OpenAPI</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/postman/taxo-timbre-api.postman_collection.json" download><Download /> Postman</a>
          </Button>
        </div>
        <nav aria-label="Secciones de la documentación" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {[{ id: "inicio", name: "Inicio rápido" }, ...groups, { id: "formatos", name: "Esquemas" }, { id: "mcp", name: "MCP" }].map(({ id, name }) => (
            <a key={id} href={`#${id}`} className="underline underline-offset-4">{name}</a>
          ))}
        </nav>
      </header>

      <section id="inicio" className="scroll-mt-6 space-y-3 text-sm">
        <h2 className="text-xl font-semibold">Inicio rápido</h2>
        <p>Usa <code>{baseUrl}</code> y envía <code>Authorization: Bearer &lt;llave&gt;</code>. Cada operación indica su alcance. <code>admin</code> y <code>access</code> incluyen todos los alcances. Puedes enviar <code>X-Request-Id</code> para rastrear la solicitud.</p>
        <p>Crea una llave de prueba, configura <code>TAXO_API_KEY</code> y guarda un valor único en <code>TICKET_IDEMPOTENCY_KEY</code> antes del primer envío. Usa <code>success</code> o <code>failure</code> para simular el resultado sin consumir créditos.</p>
        <CodeBlock code={ticketExample} />
        <p>El <code>201</code> confirma la recepción. Guarda <code>data.id</code> y consulta el ticket o suscríbete a webhooks para obtener el resultado. <code>received</code>, <code>queued</code>, <code>processing</code> y <code>pending</code> representan un ticket en curso. <code>finalized</code>, <code>failed</code>, <code>not_invoiceable</code> y <code>cancelled</code> representan resultados finales.</p>
        <p>Después de un timeout o error HTTP reintentable, repite el envío con la misma llave de idempotencia y el mismo cuerpo. Respeta <code>Retry-After</code> cuando aparezca. Una respuesta recuperada devuelve <code>Idempotent-Replayed: true</code>. Un ticket existente se consulta usando su ID.</p>
        <p>Si el envío ya tiene un resultado, revisa <code>data.error</code>. <code>NOT_INVOICEABLE</code> llega con estado <code>not_invoiceable</code> y eventos <code>ticket.failed</code> e <code>invoice.failed</code>. <code>UPSTREAM_UNAVAILABLE</code> de tipo <code>connection</code> y <code>PROVIDER_TIMEOUT</code> requieren verificar si hubo facturación antes de volver a enviar.</p>
      </section>

      {groups.map(({ name, id }) => (
        <section key={id} id={id} className="scroll-mt-6 space-y-3">
          <h2 className="text-xl font-semibold">{name}</h2>
          {id === "tickets" && (
            <div className="space-y-2 text-sm">
              <p>Envía el RFC, nombre fiscal o razón social y la imagen. Incluye código postal fiscal, régimen y uso de CFDI para facturar. Para persona física puedes enviar los tres campos de nombre por separado. La inferencia de nombres conserva los conectores <code>DE</code>, <code>DEL</code>, <code>LA</code>, <code>LAS</code> y <code>LOS</code> y requiere iniciales compatibles con el RFC. Si recibes <code>ambiguous_taxpayer_name</code>, completa los tres campos separados.</p>
              <p>Si el servicio de facturación rechaza específicamente el PDF de la constancia fiscal y no confirma la recepción, Taxo Timbre intenta el envío una vez más sin ese PDF, en el mismo ticket y sin otro cargo. Los enlaces firmados del detalle duran 15 minutos. Los de <code>invoice.finalized</code> duran 7 días.</p>
              <p>El panel permite reintentar ciertas fallas de envío previas a la confirmación. El reintento conserva el ticket y el crédito original. Los estados <code>received</code>, <code>queued</code> y <code>processing</code> tienen un límite de 30 minutos. Un ticket en <code>pending</code> puede esperar hasta 24 horas por el resultado.</p>
            </div>
          )}
          {id === "servicio" && (
            <p className="text-sm">Consulta <code>/api/v1/status</code> con una llave del modo que vas a usar. Con <code>degraded</code>, la API acepta el ticket con <code>delayed: true</code>. Con <code>down</code>, los envíos nuevos devuelven <code>503 SERVICE_UNAVAILABLE</code>, sin crear un ticket ni consumir crédito.</p>
          )}
          {id === "webhooks" && (
            <div className="space-y-2 text-sm">
              <p>Suscribe un destino a <code>ticket.finalized</code>, <code>ticket.failed</code> e <code>invoice.finalized</code> para recibir resultados y documentos. Usa <code>service.degraded</code>, <code>service.down</code> y <code>service.recovered</code> para incidentes. Se incluyen eventos de ambos modos. Usa <code>livemode</code> para distinguirlos.</p>
              <p>Verifica <code>X-Webhook-Signature</code> comparando <code>sha256=&lt;hex&gt;</code> con el HMAC-SHA256 de los bytes crudos del cuerpo, usando el secreto del destino. <code>X-Webhook-Id</code> identifica el destino y <code>X-Webhook-Event</code> indica el tipo. <code>X-Webhook-Timestamp</code> registra el intento en segundos Unix.</p>
              <p>Responde con HTTP 2xx dentro de 10 segundos y deduplica usando el <code>id</code> del evento. Si la entrega falla, se programan hasta cuatro reintentos con esperas de 1, 5, 30 y 120 minutos.</p>
              <details className="space-y-2 rounded-lg border p-3">
                <summary className="cursor-pointer">Ejemplo de <code>ticket.failed</code></summary>
                <CodeBlock code={JSON.stringify(webhookExample, null, 2)} />
              </details>
            </div>
          )}
          {operations.filter(({ operation }) => operation.tags.includes(name)).map((endpoint) => (
            <Endpoint key={endpoint.method + endpoint.path} {...endpoint} />
          ))}
        </section>
      ))}

      <section id="formatos" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-semibold">Esquemas</h2>
        <p className="text-sm text-muted-foreground">Consulta los tipos citados en las operaciones. OpenAPI incluye las definiciones completas.</p>
        {Object.entries(schemas).filter(([name]) => !name.startsWith("TicketCreate")).map(([name, schema]) => (
          <details key={name} className="rounded-lg border bg-card">
            <summary className="cursor-pointer p-3 font-mono text-xs">{name}</summary>
            <div className="px-3 pb-3"><SchemaFields schema={schema} /></div>
          </details>
        ))}
      </section>

      <section id="mcp" className="scroll-mt-6 space-y-3 text-sm">
        <h2 className="text-xl font-semibold">Servidor MCP</h2>
        <p>Conecta un cliente compatible con Streamable HTTP y OAuth a <code>{productionMcpUrl}</code>. Inicia sesión en Taxo Timbre y autoriza la organización que aparece en pantalla.</p>
        <p>Los miembros pueden consultar datos. Los propietarios y administradores también pueden consultar créditos y enviar tickets. Usa el modo test para simular. Cada ticket nuevo en modo live consume un crédito.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><code>list_tickets</code>, <code>get_ticket</code> y <code>create_ticket</code> para el flujo de facturación.</li>
          <li><code>get_service_status</code>, <code>get_stats</code> y <code>get_usage</code> para disponibilidad y consumo.</li>
          <li><code>list_webhook_destinations</code>, <code>list_webhook_event_types</code> y <code>list_webhook_deliveries</code> para consultar webhooks.</li>
        </ul>
        <p><code>create_ticket</code> usa JSON, una imagen en base64 y un argumento obligatorio <code>idempotency_key</code>. <code>get_ticket</code> devuelve enlaces firmados para los documentos. Los resultados incluyen el HTTP de la API y su respuesta, con <code>request_id</code> para rastreo.</p>
      </section>
    </div>
  );
}
