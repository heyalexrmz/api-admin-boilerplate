# Servidor MCP de Taxo Timbre

Conecta un cliente compatible con Streamable HTTP y OAuth a **`https://mcp.taxotimbre.com`**. El cliente descubre el servidor de autorización, abre el inicio de sesión de Taxo Timbre y solicita acceso a la organización indicada en la pantalla de consentimiento. Para elegir otra organización, selecciónala en el panel de Taxo Timbre antes de empezar una nueva conexión.

El flujo usa códigos de autorización con PKCE S256. El cliente puede registrarse dinámicamente y solicita los alcances `mcp:access` y `offline_access`. Los tokens de acceso vencen en 15 minutos. El cliente puede renovarlos mientras la sesión que autorizó la conexión sigue vigente. Cerrar esa sesión, retirar el consentimiento o quitar la membresía bloquea el acceso.

## Herramientas

| Herramienta | Argumentos | Rol en la organización |
| --- | --- | --- |
| `list_tickets` | `limit` (1–200, predeterminado 50), `status` | Miembro, administrador o propietario |
| `get_ticket` | `ticket_id` (UUID) | Miembro, administrador o propietario |
| `create_ticket` | `mode` (test o live), `idempotency_key`, `tax_id`, `file` (base64) y los campos fiscales del ticket | Administrador o propietario |
| `get_service_status` | `mode` (predeterminado live) | Miembro, administrador o propietario |
| `get_stats` | `days` (1–365, predeterminado 30) | Miembro, administrador o propietario |
| `get_usage` | — | Administrador o propietario |
| `list_webhook_destinations` | — | Miembro, administrador o propietario |
| `list_webhook_event_types` | — | Miembro, administrador o propietario |
| `list_webhook_deliveries` | — | Miembro, administrador o propietario |

La conexión conserva la organización autorizada aunque cambies de organización en el panel. Las consultas abarcan los datos de esa organización; en tickets y eventos, `livemode` identifica el modo de origen. Selecciona `mode: "test"` para simular facturación sin consumir créditos o `mode: "live"` para enviar el ticket para facturación. Cada ticket nuevo en live consume un crédito.

Los argumentos de `create_ticket` se descubren con `tools/list`. Envía un JPEG o PNG de hasta 10 MiB en base64 y usa caracteres ASCII visibles para `idempotency_key`. Si expira la conexión o la operación devuelve un error HTTP reintentable, repite la llamada con la misma llave y los mismos argumentos. Para usar los valores predeterminados de `list_tickets`, `get_stats` o `get_service_status`, envía `arguments: {}`.

## Resultados y errores

Las herramientas devuelven `structuredContent` y una copia en texto JSON. Cada resultado de la API incluye `http_status` y `response`. Si aplica, incluye `retry_after_seconds` o `idempotent_replayed: true`. Conserva el `request_id` dentro de `response` para rastreo.

Cuando la API devuelve un error, el resultado de MCP incluye `isError: true`. Si falta un token OAuth válido, el endpoint devuelve HTTP 401 y anuncia los metadatos de OAuth en `WWW-Authenticate`. El transporte usa POST y responde 405 a GET o DELETE.

Después de `create_ticket`, guarda `response.data.id` y usa `get_ticket` para consultar el resultado y obtener enlaces firmados. Los campos fiscales y las respuestas corresponden a la [referencia OpenAPI](../public/openapi/taxo-timbre.json). Las reglas de reintento se detallan en el [catálogo de errores](catalogo-de-errores.md).

## Desarrollo y despliegue

- Para desarrollo local, ejecuta `pnpm db:push` para crear las tablas de OAuth y arranca la app con `pnpm dev`. Usa `http://localhost:3000/api/mcp` con un cliente que admita OAuth en loopback.
- En Render, el servicio web declara `mcp.taxotimbre.com` y `MCP_RESOURCE_URL`. Conserva `BETTER_AUTH_URL` con el origen de inicio de sesión de Taxo Timbre. El paso de predespliegue aplica el esquema de OAuth.
- En DNS, el registro CNAME `mcp.taxotimbre.com` apunta a `taxo-timbre-web.onrender.com`. Tras verificar el dominio y TLS en Render, una solicitud POST sin credenciales a la raíz debe devolver 401 con `resource_metadata` en `WWW-Authenticate`. [Dominios personalizados en Render](https://render.com/docs/custom-domains)
