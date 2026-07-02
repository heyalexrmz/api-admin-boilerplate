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
    description: "Nombre completo o razón social. Para persona física se puede enviar o se infiere con nombre y apellidos.",
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
    description: "Identificador unico por intento de creacion. Reutilizalo solo para reintentar la misma solicitud.",
  },
  {
    name: "x-request-id",
    location: "header",
    requirement: "Opcional",
    type: "string",
    description: "Identificador propio para rastrear la solicitud en logs.",
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

const createTicketPersonaMoralExample = `curl -X POST https://api.taxotimbre.com/api/v1/tickets \\
  -H "Authorization: Bearer tt_live_xxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 2f4f8c76-0a1b-4a2c-9233-ff2b9946d951" \\
  -d '{
    "tax_id": "EKU9003173C9",
    "taxpayer": "Empresa Demo",
    "postal_code": "01234",
    "invoice_fiscal_regimen": "601",
    "invoice_cfdi_use": "G03",
    "file": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "csf_pdf": "JVBERi0xLjQKJcTl8uXr..."
  }'`

const createTicketPersonaFisicaExample = `curl -X POST https://api.taxotimbre.com/api/v1/tickets \\
  -H "Authorization: Bearer tt_live_xxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 7df97eec-1cf4-4a1a-9ea5-83c4612e4030" \\
  -d '{
    "tax_id": "GODE561231GR8",
    "taxpayer": "ALEJANDRO DOMINGUEZ RAMIREZ",
    "taxpayer_name": "ALEJANDRO",
    "taxpayer_last_name": "DOMINGUEZ",
    "taxpayer_second_last_name": "RAMIREZ",
    "postal_code": "01234",
    "invoice_fiscal_regimen": "612",
    "invoice_cfdi_use": "G03",
    "file": "/9j/4AAQSkZJRgABAQAAAQABAAD..."
  }'`

const createTicketResponse = `{
  "object": "ticket",
  "data": {
    "object": "ticket",
    "id": "4b96e5de-69de-4dc8-aad7-4d5045fa5b31",
    "tax_id": "EKU9003173C9",
    "status": "received",
    "livemode": true,
    "created_at": "2026-07-01T18:20:00.000Z"
  },
  "request_id": "req_123"
}`

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
]

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
      "status": "failed",
      "livemode": true,
      "created_at": "2026-07-01T18:20:00.000Z",
      "updated_at": "2026-07-01T18:23:00.000Z",
      "finalized_at": null,
      "error": {
        "code": "NOT_INVOICEABLE",
        "type": "site",
        "message": "This ticket cannot be invoiced."
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
            tickets reales y consumen créditos.
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
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Ejemplo persona moral</h3>
            <CodeBlock code={createTicketPersonaMoralExample} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Ejemplo persona física</h3>
            <CodeBlock code={createTicketPersonaFisicaExample} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Respuesta 201</h3>
            <CodeBlock code={createTicketResponse} />
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
            Se emite cuando el ticket no puede procesarse o facturarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={ticketFailedWebhook} />
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
