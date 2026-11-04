import { Download } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export const metadata = {
  title: "Documentación · Taxo Timbre",
  description: "Referencia para enviar y consultar tickets por API.",
}

const postmanCollectionUrl = "/postman/taxo-timbre-api.postman_collection.json"

const ticketStatuses = [
  "received",
  "queued",
  "pending",
  "processing",
  "finalized",
  "failed",
  "not_invoiceable",
  "cancelled",
]

const createTicketFields = [
  {
    name: "tax_id",
    location: "json body",
    requirement: "Requerido",
    type: "string",
    description: "RFC del contribuyente que recibirá la factura.",
  },
  {
    name: "taxpayer",
    location: "json body",
    requirement: "Condicional",
    type: "string",
    description: "Nombre completo o razón social. Para persona física, los nombres sencillos se separan automáticamente; los nombres ambiguos requieren los tres campos separados. Si se omite, se construye con nombre y apellidos.",
  },
  {
    name: "taxpayer_name",
    location: "json body",
    requirement: "Condicional",
    type: "string",
    description: "Nombre(s) de persona física.",
  },
  {
    name: "taxpayer_last_name",
    location: "json body",
    requirement: "Condicional",
    type: "string",
    description: "Primer apellido de persona física.",
  },
  {
    name: "taxpayer_second_last_name",
    location: "json body",
    requirement: "Condicional",
    type: "string",
    description: "Segundo apellido de persona física.",
  },
  {
    name: "postal_code",
    location: "json body",
    requirement: "Primera vez",
    type: "string",
    description: "Código postal fiscal del contribuyente.",
  },
  {
    name: "invoice_fiscal_regimen",
    location: "json body",
    requirement: "Primera vez",
    type: "string",
    description: "Código SAT del régimen fiscal, por ejemplo 601, 603 o 612.",
  },
  {
    name: "invoice_cfdi_use",
    location: "json body",
    requirement: "Primera vez",
    type: "string",
    description: "Código SAT de uso de CFDI, por ejemplo G03, I01 o D01.",
  },
  {
    name: "file",
    location: "json body",
    requirement: "Requerido",
    type: "base64 string",
    description: "Imagen del ticket en JPG, JPEG o PNG codificada en base64. Tamaño máximo: 10 MB.",
  },
  {
    name: "csf_pdf",
    location: "json body",
    requirement: "Opcional",
    type: "base64 string",
    description: "Constancia de situación fiscal en PDF codificada en base64.",
  },
  {
    name: "Content-Type",
    location: "header",
    requirement: "Requerido",
    type: "application/json",
    description: "Indica que el cuerpo se envía como JSON.",
  },
  {
    name: "Authorization",
    location: "header",
    requirement: "Requerido",
    type: "Bearer token",
    description: "Llave API activa con alcance write, admin o access.",
  },
  {
    name: "Idempotency-Key",
    location: "header",
    requirement: "Requerido",
    type: "UUID/string",
    description: "Identificador único por ticket. Reutilízalo con el mismo cuerpo para reintentar después de un 503, un 5xx o un timeout: nunca crea un segundo ticket.",
  },
  {
    name: "x-request-id",
    location: "header",
    requirement: "Opcional",
    type: "string",
    description: "Identificador propio para rastrear la solicitud en logs.",
  },
  {
    name: "test_scenario",
    location: "body",
    requirement: "Opcional",
    type: "success | failure",
    description: "Solo para llaves de prueba. Fuerza webhooks de éxito o falla sin consumir créditos.",
  },
]

const listTicketFields = [
  {
    name: "Authorization",
    location: "header",
    requirement: "Requerido",
    type: "Bearer token",
    description: "Llave API activa con alcance read, admin o access.",
  },
  {
    name: "limit",
    location: "query",
    requirement: "Opcional",
    type: "number",
    description: "Cantidad de tickets a devolver. Predeterminado: 50. Rango: 1 a 200.",
  },
  {
    name: "status",
    location: "query",
    requirement: "Opcional",
    type: "string",
    description: `Filtra por estado: ${ticketStatuses.join(", ")}.`,
  },
  {
    name: "x-request-id",
    location: "header",
    requirement: "Opcional",
    type: "string",
    description: "Identificador propio para rastrear la solicitud en logs.",
  },
]

const getTicketFields = [
  {
    name: "id",
    location: "path",
    requirement: "Requerido",
    type: "uuid",
    description: "Identificador del ticket devuelto por POST /api/v1/tickets.",
  },
  {
    name: "Authorization",
    location: "header",
    requirement: "Requerido",
    type: "Bearer token",
    description: "Llave API activa con alcance read, admin o access.",
  },
]

const createTicketExample = `curl -X POST https://api.taxotimbre.com/api/v1/tickets \\
  -H "Authorization: Bearer tt_live_xxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 2f4f8c76-0a1b-4a2c-9233-ff2b9946d951" \\
  -d '{
    "tax_id": "DORA990310A30",
    "taxpayer": "ALEJANDRO DOMINGUEZ RAMIREZ",
    "taxpayer_name": "ALEJANDRO",
    "taxpayer_last_name": "DOMINGUEZ",
    "taxpayer_second_last_name": "RAMIREZ",
    "postal_code": "03310",
    "invoice_fiscal_regimen": "626",
    "invoice_cfdi_use": "G03",
    "file": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "csf_pdf": "JVBERi0xLjQKJcTl8uXr..."
  }'`

const createTicketResponse = `{
  "object": "ticket",
  "data": {
    "object": "ticket",
    "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
    "tax_id": "EKU9003173C9",
    "status": "received",
    "livemode": true,
    "delayed": false,
    "delay_reason": null,
    "created_at": "2026-07-01T18:20:00.000Z"
  },
  "request_id": "req_123"
}`

const serviceUnavailableResponse = `HTTP/1.1 503 Service Unavailable
Retry-After: 60

{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "type": "unavailable",
    "message": "El servicio de facturación no está disponible en este momento. Intenta de nuevo más tarde.",
    "param": null,
    "retryable": true
  },
  "request_id": "req_789"
}`

const statusExample = `curl https://api.taxotimbre.com/api/v1/status \\
  -H "Authorization: Bearer tt_live_xxx"`

const statusResponse = `{
  "status": "down",
  "components": {
    "ingest": { "status": "operational", "reason": null },
    "extraction": { "status": "down", "reason": "El procesamiento de tickets está detenido." },
    "invoicing": { "status": "operational", "reason": null }
  },
  "retry_after_seconds": 60,
  "livemode": true,
  "updated_at": "2026-11-03T17:58:44.000Z",
  "request_id": "req_321"
}`

const errorCatalog = [
  { code: "SERVICE_UNAVAILABLE", retryable: "true", when: "POST rechazado con 503 porque el servicio está caído, o ticket que no avanzó de received/queued en 30 minutos (se devuelve el crédito)." },
  { code: "UPSTREAM_UNAVAILABLE", retryable: "true / false", when: "true si el servicio de facturación respondió 5xx. false (type connection) si no respondió o el envío no terminó: revisa el ticket antes de reenviar." },
  { code: "UPSTREAM_RATE_LIMITED", retryable: "true", when: "El servicio de facturación limitó solicitudes." },
  { code: "PROVIDER_TIMEOUT", retryable: "false", when: "Un ticket aceptado (pending) no recibió resultado en 24 horas." },
  { code: "NOT_INVOICEABLE", retryable: "false", when: "El comercio informó que el ticket no se puede facturar." },
  { code: "Errores de datos", retryable: "false", when: "UPSTREAM_VALIDATION, TAX_ID_INVALID, FILE_REQUIRED y similares: corrige los datos antes de reenviar." },
]

const listTicketsExample = `curl "https://api.taxotimbre.com/api/v1/tickets?limit=25&status=finalized" \\
  -H "Authorization: Bearer tt_live_xxx"`

const getTicketExample = `curl https://api.taxotimbre.com/api/v1/tickets/4b96e5de-69de-4dc8-aad7-4d5045fa5b31 \\
  -H "Authorization: Bearer tt_live_xxx"`

const ticketResponseShape = `{
  "object": "ticket",
  "data": {
    "object": "ticket",
    "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
    "tax_id": "EKU9003173C9",
    "status": "finalized",
    "livemode": true,
    "created_at": "2026-07-01T18:20:00.000Z",
    "updated_at": "2026-07-01T18:22:10.000Z",
    "finalized_at": "2026-07-01T18:22:10.000Z",
    "error": null,
    "invoice": {
      "id": "inv_123",
      "status": "finalized",
      "uuid": "SAT-UUID",
      "series": "A",
      "folio": "1024",
      "total": "249.00",
      "invoice_date": "2026-07-01T18:22:10.000Z"
    },
    "documents": []
  },
  "request_id": "req_456"
}`

const webhookHeaders = [
  {
    name: "Content-Type",
    location: "header",
    requirement: "Siempre",
    type: "application/json",
    description: "El payload se entrega como JSON.",
  },
  {
    name: "X-Webhook-Id",
    location: "header",
    requirement: "Siempre",
    type: "string",
    description: "Identificador del endpoint configurado en Webhooks.",
  },
  {
    name: "X-Webhook-Event",
    location: "header",
    requirement: "Siempre",
    type: "string",
    description: "Mismo valor que payload.type para ruteo rápido.",
  },
  {
    name: "X-Webhook-Timestamp",
    location: "header",
    requirement: "Siempre",
    type: "unix seconds",
    description: "Fecha de generación de la entrega.",
  },
  {
    name: "X-Webhook-Signature",
    location: "header",
    requirement: "Siempre",
    type: "sha256=<hex>",
    description: "HMAC-SHA256 del body crudo usando el secreto del webhook.",
  },
]

const webhookEventTypes = [
  "ticket.created",
  "ticket.processing",
  "ticket.finalized",
  "ticket.failed",
  "invoice.finalized",
  "invoice.failed",
  "delivery.succeeded",
  "delivery.failed",
  "delivery.exhausted",
  "service.degraded",
  "service.down",
  "service.recovered",
]

const serviceDownWebhook = `{
  "id": "evt_service_down_6a2c1d4e-0b8f-4d43-9a37-1f0f7b2b5c10",
  "object": "event",
  "api_version": "2026-06-28",
  "type": "service.down",
  "created": "2026-11-03T17:58:44.000Z",
  "livemode": true,
  "data": {
    "object": {
      "object": "service_status",
      "status": "down",
      "previous_status": "operational",
      "components": {
        "ingest": { "status": "operational", "reason": null },
        "extraction": { "status": "down", "reason": "El procesamiento de tickets está detenido." },
        "invoicing": { "status": "operational", "reason": null }
      },
      "retry_after_seconds": 60,
      "changed_at": "2026-11-03T17:58:44.000Z",
      "updated_at": "2026-11-03T17:58:44.000Z"
    }
  },
  "request": {
    "id": null,
    "idempotency_key": null
  }
}`

const ticketCreatedWebhook = `{
  "id": "evt_ticket_created_1fb6a3a2-7c29-4b9c-a775-f0c5e7bfe2a1",
  "object": "event",
  "api_version": "2026-06-28",
  "type": "ticket.created",
  "created": "2026-07-01T18:20:00.000Z",
  "livemode": true,
  "data": {
    "object": {
      "object": "ticket",
      "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
      "tax_id": "EKU9003173C9",
      "status": "received",
      "livemode": true,
      "created_at": "2026-07-01T18:20:00.000Z"
    }
  },
  "request": {
    "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
    "idempotency_key": "ticket-idempotency-key"
  }
}`

const ticketFailedWebhook = `{
  "id": "evt_ticket_failed_3f40b7f4-5bf2-489f-9ed9-dca9daff01aa",
  "object": "event",
  "api_version": "2026-06-28",
  "type": "ticket.failed",
  "created": "2026-07-01T18:23:00.000Z",
  "livemode": true,
  "data": {
    "object": {
      "object": "ticket",
      "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
      "tax_id": "EKU9003173C9",
      "status": "not_invoiceable",
      "livemode": true,
      "created_at": "2026-07-01T18:20:00.000Z",
      "updated_at": "2026-07-01T18:23:00.000Z",
      "finalized_at": null,
      "error": {
        "code": "NOT_INVOICEABLE",
        "type": "site",
        "message": "This ticket cannot be invoiced.",
        "retryable": false
      },
      "invoice": null,
      "documents": []
    }
  },
  "request": {
    "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
    "idempotency_key": "ticket-idempotency-key"
  }
}`

const ticketProviderTimeoutWebhook = `{
  "id": "evt_ticket_failed_f7a51617-8a89-4c89-a3ed-f10a311b0235",
  "object": "event",
  "api_version": "2026-06-28",
  "type": "ticket.failed",
  "created": "2026-07-03T14:55:17.851Z",
  "livemode": true,
  "data": {
    "object": {
      "object": "ticket",
      "id": "ed6b3769-51b4-4b79-95d0-5f87adc06c2b",
      "status": "failed",
      "error": {
        "code": "PROVIDER_TIMEOUT",
        "type": "upstream",
        "message": "No recibimos el resultado de la facturación a tiempo. Revisa si la factura se emitió antes de enviar el ticket otra vez.",
        "retryable": false
      }
    }
  },
  "request": {
    "id": "ed6b3769-51b4-4b79-95d0-5f87adc06c2b",
    "idempotency_key": "ticket-idempotency-key"
  }
}`

const invoiceFinalizedWebhook = `{
  "id": "evt_invoice_finalized_2b4b3d3e-4452-4f36-b8ed-5cfd7dc81f11",
  "object": "event",
  "api_version": "2026-06-28",
  "type": "invoice.finalized",
  "created": "2026-07-01T18:24:00.000Z",
  "livemode": true,
  "data": {
    "object": {
      "object": "invoice",
      "id": "inv_123",
      "status": "finalized",
      "ticket_id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
      "livemode": true,
      "uuid": "SAT-UUID",
      "series": "A",
      "folio": "1024",
      "issuer_taxpayer": "Emisor Demo SA de CV",
      "issuer_rfc": "EKU9003173C9",
      "total": "249.00",
      "invoice_date": "2026-07-01T18:22:10.000Z",
      "documents": [
        {
          "id": "doc_pdf_123",
          "kind": "invoice_pdf",
          "content_type": "application/pdf",
          "bytes": 39122,
          "url": "https://facturador-invoices.s3.us-east-1.amazonaws.com/organizations/org_123/taxpayers/EKU9003173C9/tickets/4b96e5de-69de-4dc8-aad7-4d5045fa5b31/doc_pdf_123-invoice.pdf",
          "created_at": "2026-07-01T18:24:00.000Z"
        },
        {
          "id": "doc_xml_123",
          "kind": "invoice_xml",
          "content_type": "application/xml",
          "bytes": 9421,
          "url": "https://facturador-invoices.s3.us-east-1.amazonaws.com/organizations/org_123/taxpayers/EKU9003173C9/tickets/4b96e5de-69de-4dc8-aad7-4d5045fa5b31/doc_xml_123-invoice.xml",
          "created_at": "2026-07-01T18:24:00.000Z"
        }
      ]
    }
  },
  "request": {
    "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
    "idempotency_key": "ticket-idempotency-key"
  }
}`

const deliveryFailedWebhook = `{
  "id": "evt_delivery_failed_0d3d7d43-bd36-48a3-9a7d-c6ffbd04e972",
  "object": "event",
  "api_version": "2026-06-28",
  "type": "delivery.failed",
  "created": "2026-07-01T18:25:00.000Z",
  "livemode": true,
  "data": {
    "object": {
      "object": "delivery",
      "id": "del_123",
      "event_id": "evt_invoice_finalized_2b4b3d3e-4452-4f36-b8ed-5cfd7dc81f11",
      "event_type": "invoice.finalized",
      "status": "failed",
      "http_status": 500,
      "attempt_count": 1,
      "latency_ms": 842,
      "response_body": "Internal Server Error"
    }
  },
  "request": {
    "id": null,
    "idempotency_key": null
  }
}`

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <Badge variant={method === "POST" ? "default" : "secondary"}>
      {method}
    </Badge>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-foreground">
      <code>{code}</code>
    </pre>
  )
}

function FieldsTable({
  fields,
}: {
  fields: {
    name: string
    location: string
    requirement: string
    type: string
    description: string
  }[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Valor</TableHead>
          <TableHead>Ubicación</TableHead>
          <TableHead>Uso</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Notas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => (
          <TableRow key={`${field.location}-${field.name}`}>
            <TableCell className="font-mono text-xs">{field.name}</TableCell>
            <TableCell>{field.location}</TableCell>
            <TableCell>
              <Badge
                variant={field.requirement === "Requerido" ? "default" : "outline"}
              >
                {field.requirement}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{field.type}</TableCell>
            <TableCell className="whitespace-normal text-muted-foreground">
              {field.description}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ApiReferenceContent() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Autenticación</CardTitle>
          <CardDescription>
            Todas las solicitudes usan una llave API activa en el header Authorization.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CodeBlock code={`Authorization: Bearer tt_live_xxx`} />
          <p className="text-sm text-muted-foreground">
            Las llaves de prueba crean tickets en modo sandbox. Las llaves live crean
            tickets reales y consumen créditos. Las solicitudes con llaves de prueba
            no descuentan créditos y pueden usar test_scenario para disparar flujos
            de éxito o falla.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method="POST" />
            <CardTitle>/api/v1/tickets</CardTitle>
          </div>
          <CardDescription>
            Envía un ticket para procesamiento. La solicitud debe ser JSON con la
            imagen del ticket codificada en base64.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldsTable fields={createTicketFields} />
          <p className="text-sm text-muted-foreground">
            Para RFC de persona física, si solo envías taxpayer, se intenta separar
            el nombre completo ignorando los conectores DE, DEL, LA, LAS y LOS,
            tomando las dos últimas palabras restantes como apellidos y comprobando
            sus iniciales contra el RFC. Los RFC genéricos se excluyen. Es una
            inferencia, no una validación de identidad ante el SAT. Los nombres con
            otras partículas, con un solo apellido o con iniciales que no coinciden
            requieren datos explícitos. Envía los tres campos juntos:
            taxpayer_name, taxpayer_last_name y taxpayer_second_last_name.
            Si ya están completos, se conservan sin inferir otros valores.
          </p>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Ejemplo</h3>
            <CodeBlock code={createTicketExample} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Respuesta 201</h3>
            <CodeBlock code={createTicketResponse} />
            <p className="text-sm text-muted-foreground">
              Un 201 significa que el ticket entra a procesamiento. Si el servicio
              está degradado, el ticket se acepta con delayed: true y delay_reason
              explica el motivo; el procesamiento tardará más de lo normal.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Respuesta 503: servicio no disponible</h3>
            <CodeBlock code={serviceUnavailableResponse} />
            <p className="text-sm text-muted-foreground">
              Cuando la extracción o la facturación están caídas, la solicitud se
              rechaza en el momento: no se crea el ticket ni se descuenta crédito.
              Espera los segundos de Retry-After y reintenta con el mismo
              Idempotency-Key y el mismo cuerpo.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <h3 className="font-medium text-foreground">Reintentos idempotentes</h3>
            <p>
              Reintentar POST /api/v1/tickets con el mismo Idempotency-Key y el mismo
              cuerpo después de un 503, un 5xx o un timeout nunca crea un segundo
              ticket ni cobra dos veces. Si el primer intento sí creó el ticket, se
              devuelve ese mismo ticket con HTTP 201 y el header
              Idempotent-Replayed: true. Las solicitudes simultáneas con la misma
              llave se serializan y devuelven el mismo ticket. Reutilizar la llave
              con un cuerpo distinto responde HTTP 409 idempotency_key_reused.
            </p>
            <p>
              Todos los errores incluyen error.retryable. Es true cuando repetir la
              misma solicitud puede funcionar (5xx, 429, 503) y false cuando hay que
              corregir algo (4xx).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method="GET" />
            <CardTitle>/api/v1/status</CardTitle>
          </div>
          <CardDescription>
            Disponibilidad actual de la recepción (ingest), el procesamiento de
            tickets (extraction) y la facturación (invoicing) para el modo de la llave.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Ejemplo</h3>
            <CodeBlock code={statusExample} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Respuesta</h3>
            <CodeBlock code={statusResponse} />
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              El estado se calcula con resultados reales, no con un ping:
              extraction queda down si el procesador de tickets deja de reportar
              actividad por 90 segundos o un ticket espera más de 5 minutos en la
              cola (degraded a partir de 1 minuto). invoicing usa los resultados de
              los últimos 10 minutos: down si al menos la mitad de los intentos
              (mínimo 3) fallaron por indisponibilidad del servicio, degraded a
              partir del 20 % o si el servicio está limitando solicitudes.
            </p>
            <p>
              status es el peor de los componentes. Cuando es down, POST
              /api/v1/tickets responde 503. Un 5xx o timeout de este endpoint
              también debe tratarse como down. Con llaves de prueba solo aplican
              los incidentes declarados para el sandbox.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method="GET" />
            <CardTitle>/api/v1/tickets</CardTitle>
          </div>
          <CardDescription>
            Consulta tickets recientes de la organización asociada a la llave API.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldsTable fields={listTicketFields} />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Ejemplo</h3>
            <CodeBlock code={listTicketsExample} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method="GET" />
            <CardTitle>/api/v1/tickets/:id</CardTitle>
          </div>
          <CardDescription>
            Obtiene un ticket específico, incluyendo factura y documentos cuando ya
            estén disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldsTable fields={getTicketFields} />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Ejemplo</h3>
            <CodeBlock code={getTicketExample} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Respuesta</h3>
            <CodeBlock code={ticketResponseShape} />
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <h3 className="font-medium text-foreground">Tiempo máximo por estado (SLA)</h3>
            <p>
              Ningún ticket se queda activo indefinidamente. Si no avanza de
              received o queued en 30 minutos, pasa a failed con
              SERVICE_UNAVAILABLE (retryable: true) y se devuelve el crédito,
              porque nunca se envió a facturar. Si queda en processing 30 minutos,
              pasa a failed con UPSTREAM_UNAVAILABLE de tipo connection
              (retryable: false), porque el servicio pudo haberlo recibido. Un
              ticket pending (aceptado por el servicio de facturación) falla con
              PROVIDER_TIMEOUT si no hay resultado en 24 horas. En todos los casos
              se emite ticket.failed.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Códigos de error del ticket</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>error.code</TableHead>
                  <TableHead>retryable</TableHead>
                  <TableHead>Cuándo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorCatalog.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-mono text-xs">{row.retryable}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{row.when}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              error.message está en español y puede mostrarse al usuario final; no
              menciona proveedores internos. Toma decisiones con error.code y
              error.retryable, no con el texto.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <h3 className="font-medium text-foreground">Rechazos y errores de facturación</h3>
            <p>
              Los errores de procesamiento marcan el ticket como failed. Un rechazo
              con código NOT_INVOICEABLE lo marca como not_invoiceable (No facturable).
              Ambos emiten ticket.failed con error.code, error.type y error.message
              en cuanto se recibe la respuesta. No se reenvía automáticamente el ticket.
            </p>
            <p>
              HTTP 429 se clasifica como UPSTREAM_RATE_LIMITED de tipo quota.
              Aunque el rechazo indique un tiempo de espera, el ticket queda fallido
              y el motivo se informa de inmediato. Los errores de datos, acceso,
              conexión y servidor se clasifican por separado.
            </p>
            <p>
              En GET /api/v1/stats, tickets.success_rate y tickets.error_rate usan
              como denominador los tickets finalized + failed. Los tickets
              not_invoiceable, activos y cancelados quedan excluidos. Las tasas
              son fracciones entre 0 y 1; ambas son 0 si no hay resultados evaluables.
              tickets.total y tickets.by_status incluyen todos los estados.
            </p>
            <p>
              La respuesta inicial HTTP 201 confirma la recepción del ticket.
              El resultado de la facturación se consulta en este endpoint o se recibe
              por webhook. Las respuestas públicas usan nombres neutrales y no
              exponen la identidad del servicio externo ni su respuesta cruda.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WebhookExamplesContent() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Entrega de webhooks</CardTitle>
          <CardDescription>
            Cada evento se envía como POST firmado al endpoint configurado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldsTable fields={webhookHeaders} />
          <p className="text-sm text-muted-foreground">
            Para validar la firma, calcula HMAC-SHA256 sobre el body crudo con
            el secreto del webhook y compara el resultado con X-Webhook-Signature.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tipos de evento</CardTitle>
          <CardDescription>
            Usa payload.type para enrutar cada evento y payload.data.object para mapear
            la entidad recibida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {webhookEventTypes.map((eventType) => (
            <Badge key={eventType} variant="outline">
              {eventType}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ticket.created</CardTitle>
          <CardDescription>
            Se emite cuando la API recibe el ticket y crea el registro inicial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={ticketCreatedWebhook} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ticket.failed</CardTitle>
          <CardDescription>
            Se emite cuando el ticket no puede procesarse o facturarse. El estado
            not_invoiceable distingue un ticket no facturable de una falla técnica
            (failed). invoice.failed conserva su formato actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={ticketFailedWebhook} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ticket.failed por timeout</CardTitle>
          <CardDescription>
            Si el proveedor no confirma éxito o fallo en 24 horas, el ticket falla
            automáticamente con PROVIDER_TIMEOUT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={ticketProviderTimeoutWebhook} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>service.degraded, service.down y service.recovered</CardTitle>
          <CardDescription>
            Se emiten una vez por cambio de estado de GET /api/v1/status, firmados
            igual que los demás eventos, para avisar a tus usuarios y pausar envíos
            sin esperar a que fallen tickets. service.recovered indica que el
            estado volvió a operational. Suscríbete a ellos en Webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={serviceDownWebhook} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>invoice.finalized</CardTitle>
          <CardDescription>
            Se emite cuando la factura queda lista e incluye enlaces a XML/PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={invoiceFinalizedWebhook} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>delivery.failed</CardTitle>
          <CardDescription>
            Se emite cuando una entrega a webhook falla y debe revisarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={deliveryFailedWebhook} />
        </CardContent>
      </Card>
    </div>
  )
}

export default function DocumentationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Importa la colección en Postman para probar tickets, consultas y payloads
          de webhooks con variables reutilizables.
        </p>
        <Button asChild variant="outline">
          <a href={postmanCollectionUrl} download>
            <Download data-icon="inline-start" />
            Descargar colección Postman
          </a>
        </Button>
      </div>

      <Tabs defaultValue="tickets" className="gap-6">
        <TabsList>
          <TabsTrigger value="tickets">Tickets API</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>
        <TabsContent value="tickets">
          <ApiReferenceContent />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhookExamplesContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
