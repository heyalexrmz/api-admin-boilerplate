# Catálogo de errores de Taxo Timbre

**Fecha:** 1 de octubre de 2026.

**Audiencia:** integradores, soporte y equipo de producto.
**Alcance:** API v1, recepción de tickets, procesamiento de facturación y notificaciones de falla. Describe el código local revisado; su aplicación en producción requiere desplegar la aplicación y el worker.

Taxo Timbre comunica cada falla mediante un código estable, una categoría y un motivo legible. **Los errores de procesamiento dejan el ticket en `failed`; los rechazos con código `NOT_INVOICEABLE` lo dejan en `not_invoiceable` (No facturable). En ambos casos se emite `ticket.failed` en cuanto se procesa el resultado. No se espera una ventana de disponibilidad ni se reenvía automáticamente el ticket.** Esta regla también aplica a los límites temporales de solicitudes.

## Política de comunicación

- Las pantallas, respuestas de API, webhooks y documentos públicos utilizan «servicio de facturación» o «comercio». Nunca muestran el nombre comercial del proveedor externo.
- Se conserva el motivo útil para corregir el problema. Los nombres, enlaces e identificadores internos del servicio externo se omiten de los mensajes públicos.
- El cliente recibe `error.code`, `error.type` y `error.message`. Debe tomar decisiones con el código y el estado; el texto puede variar o venir en distintos idiomas.
- Un rechazo explícito se comunica como falla desde el primer intento. Que su causa sea temporal no convierte el ticket en una solicitud pendiente.
- Una falla de conexión o una respuesta sin confirmación también deja el ticket fallido. En estos casos debe revisarse el resultado antes de crear otro envío, porque no hay certeza de si el servicio recibió la solicitud.
- La respuesta cruda y el HTTP del servicio externo se conservan para diagnóstico interno; no forman parte del error público.

## Cuándo se informa el error

| Momento | Respuesta o evento | Significado |
| --- | --- | --- |
| La petición a nuestra API es inválida o no tiene permiso | HTTP 4xx con `error` | La API rechaza esa operación de inmediato. |
| Se recibe correctamente un ticket | HTTP 201 con `status: received` | Se registró la solicitud. La facturación continúa de forma asíncrona. |
| Se comienza a enviar para procesamiento | `ticket.processing` | Comenzó el intento de procesamiento. |
| Se recibe un rechazo durante el envío | Estado `failed` y evento `ticket.failed` con el motivo | El intento terminó. No se programa otro envío. |
| Se acepta el envío | Estado `pending` | Se espera el resultado posterior de la facturación. |
| Se recibe un resultado posterior sin factura | `ticket.failed` e `invoice.failed` | El ticket queda `not_invoiceable` si el código es `NOT_INVOICEABLE`; los demás errores quedan `failed`. |
| No llega un resultado durante 24 horas de espera o procesamiento | `PROVIDER_TIMEOUT`, `ticket.failed` e `invoice.failed` | Se agotó la espera del resultado. |

«Inmediato» significa que se guarda la falla y se despacha su notificación en la misma ejecución que procesa el rechazo, sin aplazarla por un reintento. No significa que la respuesta inicial HTTP 201 espere la facturación. El worker revisa normalmente la cola cada dos segundos, y los webhooks dependen de que el destino esté habilitado, suscrito y disponible. El estado actualizado también puede consultarse con `GET /api/v1/tickets/:id`.

Los reintentos de **entrega del webhook** son independientes: pueden repetir una notificación que no llegó al cliente, pero no vuelven a enviar el ticket para facturar.

## Reintento manual desde el dashboard

Los propietarios, administradores y superadministradores pueden usar **Reintentar** en la lista o el detalle de un ticket cuyo envío haya fallado, siempre que no exista confirmación de recepción del servicio ni una factura asociada. No está disponible para tickets activos, finalizados, cancelados, no facturables ni para fallas posteriores a la recepción.

El reintento conserva el ticket, los archivos, los datos fiscales y la llave de idempotencia del envío original, sin descontar otro crédito. Registra la falla anterior y el usuario que solicitó el reintento en un nuevo trabajo de la cola; después devuelve el ticket a `received`. El worker vuelve a enviarlo y publica el resultado mediante los eventos habituales. Las solicitudes simultáneas no crean varios reintentos y un trabajo de envío aún activo impide crear otro.

La lista y el detalle abierto actualizan el estado mientras hay tickets activos. Si el nuevo envío falla, vuelve a quedar `failed`: cualquier intento adicional requiere otra acción manual.

En los envíos nuevos y los reintentos se intenta separar `taxpayer` cuando el RFC tiene formato de persona física y faltan los tres campos de nombre. La inferencia toma las dos últimas palabras como apellidos, excluye los RFC genéricos y requiere iniciales compatibles con el RFC. No valida la identidad ante el SAT. Los nombres con partículas de apellidos compuestos, signos no reconocidos o iniciales incompatibles requieren los campos separados; si se proporciona alguno, deben enviarse los tres completos. Las peticiones nuevas ambiguas reciben HTTP 400 antes de consumir un crédito. Para un ticket histórico, el worker conserva los datos originales, lo deja en `failed` con tipo `validation`, emite `ticket.failed` y no contacta al servicio externo ni repite el trabajo automáticamente.

## Formato de los errores de API

Un error al ejecutar una operación HTTP tiene este formato:

```json
{
  "error": {
    "code": "missing_field",
    "type": "validation_error",
    "message": "taxpayer_last_name is required for persona fisica.",
    "param": "taxpayer_last_name"
  },
  "request_id": "req_ejemplo"
}
```

`param` identifica el campo afectado cuando corresponde; de lo contrario es `null`. `request_id` permite localizar la operación en los registros.

## Errores de acceso y permisos

| Código | HTTP | Tipo | Motivo y acción |
| --- | --- | --- | --- |
| `missing_authorization` | 401 | `authentication_error` | Falta el encabezado `Authorization`. Enviar `Bearer` con una llave válida. |
| `invalid_scheme` | 401 | `authentication_error` | El encabezado no usa el esquema `Bearer`. Corregir su formato. |
| `invalid_api_key` | 401 | `authentication_error` | La llave está vacía, es inválida, fue revocada o expiró. Revisar la llave utilizada. |
| `insufficient_scope` | 403 | `authorization_error` | La llave no tiene el permiso requerido para la operación. Revisar sus permisos. |
| `invalid_document_signature` | 403 | `authorization_error` | El enlace firmado del documento es inválido o expiró. Obtener un enlace vigente desde el detalle del ticket. |

## Errores de entrada y recursos

| Código | HTTP | Tipo | Motivo y acción |
| --- | --- | --- | --- |
| `invalid_json` | 400 | `validation_error` | El cuerpo no es JSON válido. Corregir la sintaxis. |
| `invalid_payload` | 400 | `validation_error` | La estructura del cuerpo es inválida o faltan identificadores necesarios. Revisar el contrato de la operación. |
| `missing_field` | 400 | `validation_error` | Falta un campo obligatorio. Consultar `param` y `message`. |
| `ambiguous_taxpayer_name` | 400 | `validation_error` | El RFC tiene formato de persona física, pero no se puede separar `taxpayer` de forma conservadora. Enviar `taxpayer_name`, `taxpayer_last_name` y `taxpayer_second_last_name` completos. |
| `tax_id_required` | 400 | `validation_error` | Falta el RFC del contribuyente. Completar `tax_id`. |
| `missing_file` | 400 | `validation_error` | Falta el archivo requerido. Adjuntar la imagen o archivo señalado. |
| `invalid_base64` | 400 | `validation_error` | El archivo no tiene una codificación base64 válida. Corregir su codificación. |
| `invalid_file_type` | 400 | `validation_error` | El contenido, extensión o tipo del archivo es incorrecto. El ticket admite JPEG o PNG; la constancia fiscal debe ser PDF. |
| `file_too_large` | 413 | `validation_error` | La imagen del ticket excede 10 MiB, es decir, 10 × 1024 × 1024 bytes. Reducir su tamaño. |
| `invalid_test_scenario` | 400 | `validation_error` | El escenario de sandbox no es válido. Usar `success` o `failure`. |
| `invalid_destination` | 400 | `validation_error` | Los datos del destino de webhook no cumplen su esquema. Corregir el cuerpo de la solicitud. |
| `not_found` | 404 | `validation_error` | El ticket, documento o destino solicitado no está disponible para esa operación. Revisar el identificador y la organización. |

## Créditos y errores internos de API

| Código | HTTP | Tipo | Motivo y acción |
| --- | --- | --- | --- |
| `insufficient_credits` | 402 | `rate_limit_error` | La organización no tiene créditos suficientes para crear un ticket live. Revisar el saldo. La categoría actual es `rate_limit_error`, aunque la causa es el saldo de créditos. |
| `internal_error` | 500 | `internal_error` | Ocurrió una excepción interna no clasificada. Compartir `request_id` con soporte y verificar si ya existe el ticket antes de repetir la creación. |

## Errores de envío y facturación

Estos códigos pertenecen al objeto del ticket y a los eventos de falla. **No son el HTTP de la respuesta inicial de creación.** Todos los rechazos de envío de esta tabla terminan en `failed` y disparan `ticket.failed` en el mismo intento.

| Código | Tipo | Cuándo ocurre | Motivo y acción |
| --- | --- | --- | --- |
| `UPSTREAM_RATE_LIMITED` | `quota` | El servicio de facturación responde HTTP 429. | Se alcanzó un límite temporal de solicitudes. El ticket queda fallido; esperar o escalar el límite antes de decidir un nuevo envío. |
| `UPSTREAM_AUTH_ERROR` | `auth` | El servicio responde HTTP 401 o 403. | Falló el acceso del servicio de facturación. Contactar a soporte; este código no significa que la llave API del cliente sea inválida. |
| `UPSTREAM_UNAVAILABLE` | `upstream` | El servicio responde HTTP 5xx. | El servicio no está disponible o tuvo una falla interna. Soporte debe revisar el caso antes de otro envío. |
| `UPSTREAM_UNAVAILABLE` | `connection` | Hay un error de conexión, se agota la espera del envío o se recibe HTTP 408. | No se obtuvo una respuesta a tiempo. La espera de red configurada para el envío es de 30 segundos. Revisar el estado antes de duplicar la solicitud. |
| `UPSTREAM_INVALID_RESPONSE` | `upstream` | Se recibe HTTP 2xx sin confirmación válida de recepción. | No se pudo confirmar que el ticket fue aceptado. Contactar a soporte. |
| `FILE_REQUIRED` | `validation` | El servicio señala que falta la imagen. | Revisar el archivo enviado. |
| `TAX_ID_INVALID` | `validation` | El servicio señala que el RFC es inválido. | Revisar los datos fiscales indicados. |
| `UPSTREAM_VALIDATION` | `validation` | Un HTTP 400 o 422 incluye un detalle de validación. | Corregir el campo o dato mencionado en `message`. |
| `INSUFFICIENT_BALANCE` | `balance` | Se informa saldo insuficiente en el servicio de facturación. | Contactar a soporte. Es distinto de los créditos de la organización. |
| `UPSTREAM_REJECTED` | `upstream` | Hay otro rechazo con un mensaje legible. | Revisar el motivo informado. También es la clasificación actual de ciertos HTTP 400 que solo contienen `message` o `error`. |
| `UNKNOWN_UPSTREAM` | `upstream` | La respuesta no se puede clasificar con la información disponible. | Contactar a soporte con el identificador del ticket. |

El estado HTTP del servicio tiene prioridad sobre el nombre de los campos de su respuesta. La presencia de `detail` no demuestra que sea un error de validación: un HTTP 429 se clasifica como `quota`.

En registros históricos, un mensaje de límite temporal puede haber quedado guardado como `UPSTREAM_VALIDATION`. Las vistas públicas lo normalizan a `UPSTREAM_RATE_LIMITED` sin reactivar el ticket ni modificar la evidencia original.

## Errores posteriores y de preparación

| Código | Tipo | Cuándo ocurre | Comunicación actual |
| --- | --- | --- | --- |
| `NOT_INVOICEABLE` | `site` | El comercio informa que el ticket no se puede facturar. | `not_invoiceable` (No facturable), con el motivo original; eventos `ticket.failed` e `invoice.failed` por compatibilidad. El payload del ticket lleva `status: not_invoiceable`; el de la factura conserva `status: failed`. |
| `MERCHANT_ERROR` | `site` | El comercio devuelve un mensaje de falla sin un código específico. | `failed`, conservando el motivo legible; eventos de falla del ticket y la factura. |
| Código específico del comercio | `site` | La respuesta incluye un código de negocio propio. | Se conserva cuando no expone identidad interna. Un ejemplo recibido puede ser `UPSTREAM_ERROR`; su significado concreto depende de `message`. No existe una definición local única para todos esos códigos. |
| `PROVIDER_TIMEOUT` | `upstream` | No llega un resultado final durante 24 horas de espera o procesamiento. | `failed`, con `ticket.failed` e `invoice.failed`. No confundir con los 30 segundos de espera de una petición de envío. |
| `IMAGE_MISSING` | `validation` | La imagen no está disponible en almacenamiento al intentar el envío. | El ticket queda `failed`. Actualmente esta rama no emite `ticket.failed`; el error se consulta en el estado. |
| `INTAKE_FAILED` | `internal` | Falla la preparación o persistencia después de registrar el ticket. | El ticket queda `failed`. Actualmente esta rama no emite `ticket.failed`; el error se consulta en el estado. |
| `TEST_SCENARIO_FAILED` | `test` | Una prueba de sandbox solicita una falla. | `failed`, con eventos de falla. No representa una facturación real. |

## Ejemplo de notificación por límite temporal

Fragmento del evento entregado al cliente:

```json
{
  "type": "ticket.failed",
  "data": {
    "object": {
      "object": "ticket",
      "id": "00000000-0000-4000-8000-000000000001",
      "status": "failed",
      "error": {
        "code": "UPSTREAM_RATE_LIMITED",
        "type": "quota",
        "message": "Se alcanzó el límite temporal de solicitudes del servicio de facturación."
      }
    }
  }
}
```

La interfaz muestra «No facturable» para `not_invoiceable` y «No se pudo facturar el ticket» para `failed`, conservando el motivo y el código. Para un límite temporal también aclara que el ticket no se reenviará automáticamente. Un tiempo de espera recibido se conserva para diagnóstico y no constituye una programación de reenvío ni una garantía de disponibilidad futura.

## Cómo debe actuar una integración

1. Revisar el HTTP de la operación. Si hay un error de API, usar `code`, `param` y `request_id` para corregirlo o escalarlo.
2. Después de un HTTP 201, conservar el identificador del ticket y esperar el webhook o consultar su estado.
3. Al recibir `ticket.failed`, registrar el motivo y comunicarlo al usuario de inmediato. No presentar ese ticket como pendiente de reintento.
4. Corregir los datos cuando corresponda. En fallas de conexión, respuestas ambiguas o errores internos, verificar primero si hubo procesamiento antes de crear otra solicitud.
5. Para soporte, compartir el identificador del ticket, código, mensaje, hora del incidente y `request_id` si existe. No incluir llaves API ni credenciales.

Repetir la creación con la misma llave de idempotencia recupera la respuesta de recepción guardada; no reactiva un ticket fallido. Crear una nueva solicitud live puede consumir otro crédito. Este cambio de manejo de errores no introduce reembolsos automáticos.

## Métricas de facturación

`GET /api/v1/stats` conserva todos los tickets en `tickets.total` y `tickets.by_status`, incluyendo `not_invoiceable` como categoría independiente. Las tasas de salud usan únicamente resultados evaluables:

- `tickets.success_rate = finalized / (finalized + failed)`.
- `tickets.error_rate = failed / (finalized + failed)`.
- Los no facturables, activos y cancelados no forman parte del denominador. Si no hay resultados evaluables, ambas tasas son `0`.

Las tasas son fracciones entre 0 y 1. Esto cambia el denominador anterior de `error_rate`, que incluía todos los tickets. El resumen del dashboard muestra la tasa de éxito como porcentaje y «—» si no hay resultados evaluables. Los conteos de fallidos y no facturables se muestran por separado. Las métricas HTTP de la API siguen midiendo respuestas HTTP.

`pnpm db:push` y `pnpm db:migrate` ejecutan el backfill después de confirmar el cambio de esquema. También puede repetirse con `pnpm db:backfill-not-invoiceable`. Reclasifica únicamente tickets `failed` con `error_code = 'NOT_INVOICEABLE'`; conserva motivos, fechas y payloads históricos y no reenvía webhooks.
