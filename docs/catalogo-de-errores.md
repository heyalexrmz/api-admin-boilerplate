# Catálogo de errores de Taxo Timbre

**Fecha:** 3 de noviembre de 2026 (disponibilidad, SLA y reintentos idempotentes). Versión anterior: 1 de octubre de 2026.

**Audiencia:** integradores, soporte y equipo de producto.
**Alcance:** API v1, recepción de tickets, procesamiento de facturación y notificaciones de falla. Describe el código local revisado; su aplicación en producción requiere desplegar la aplicación y el worker.

Taxo Timbre comunica cada falla mediante un código estable, una categoría y un motivo legible. **Los errores de procesamiento dejan el ticket en `failed`; los rechazos con código `NOT_INVOICEABLE` lo dejan en `not_invoiceable` (No facturable). En ambos casos se emite `ticket.failed` en cuanto se procesa el resultado. No se espera una ventana de disponibilidad ni se reenvía automáticamente el ticket.** Esta regla también aplica a los límites temporales de solicitudes.

**La API informa la disponibilidad en el momento de la llamada.** Si la extracción o la facturación están caídas, `POST /api/v1/tickets` responde HTTP 503 con `Retry-After` y no crea el ticket. `GET /api/v1/status` expone el estado medido, y los webhooks `service.degraded`, `service.down` y `service.recovered` avisan cada cambio. Ningún ticket queda activo indefinidamente: el SLA está en [Tiempo máximo por estado](#tiempo-máximo-por-estado-sla).

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
| La extracción o la facturación están caídas | HTTP 503 `SERVICE_UNAVAILABLE` con `Retry-After` | No se crea el ticket ni se cobra crédito. Reintentar con el mismo `Idempotency-Key` después de `Retry-After`. |
| Se recibe correctamente un ticket | HTTP 201 con `status: received` y `delayed: false` | Se registró la solicitud. La facturación continúa de forma asíncrona. |
| Se recibe un ticket con el servicio degradado | HTTP 201 con `delayed: true` y `delay_reason` | Se aceptó, pero el procesamiento tardará más de lo normal. |
| Un ticket no avanza de `received`/`queued` en 30 minutos | `SERVICE_UNAVAILABLE`, `ticket.failed` | Nunca se envió a facturar; se devuelve el crédito y es reintentable. |
| Un ticket queda en `processing` 30 minutos | `UPSTREAM_UNAVAILABLE` (tipo `connection`), `ticket.failed` | El envío no terminó; revisar antes de reenviar. |
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
    "param": "taxpayer_last_name",
    "retryable": false
  },
  "request_id": "req_ejemplo"
}
```

`param` identifica el campo afectado cuando corresponde; de lo contrario es `null`. `request_id` permite localizar la operación en los registros. `retryable` indica si repetir **la misma** solicitud (mismo `Idempotency-Key` y mismo cuerpo) puede funcionar: es `true` en HTTP 429, 5xx y 503, y `false` en los demás 4xx, que requieren corregir algo.

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
| `idempotency_key_reused` | 409 | `conflict_error` | El `Idempotency-Key` ya se usó con un cuerpo distinto. Usar una llave nueva para un ticket distinto. `retryable: false`. |
| `SERVICE_UNAVAILABLE` | 503 | `unavailable` | La extracción o la facturación están caídas. No se creó el ticket ni se cobró crédito. Esperar `Retry-After` (segundos) y reintentar con el mismo `Idempotency-Key`. `retryable: true`. |
| `internal_error` | 500 | `internal_error` | Ocurrió una excepción interna no clasificada. Es seguro reintentar con el mismo `Idempotency-Key`: si el ticket se creó, se devuelve ese ticket. `retryable: true`. |

## Errores de envío y facturación

Estos códigos pertenecen al objeto del ticket y a los eventos de falla. **No son el HTTP de la respuesta inicial de creación.** Todos los rechazos de envío de esta tabla terminan en `failed` y disparan `ticket.failed` en el mismo intento.

Cada `error` de ticket incluye `retryable`. En el ticket, `true` significa que se puede volver a enviar la misma compra como un ticket nuevo sin cambiar datos; `false` significa que hay que corregir datos, que el ticket no es facturable, o que el primer intento pudo haberse procesado y debe revisarse antes. El `message` está en español, es apto para el usuario final y no menciona proveedores internos; los códigos de servicio usan un texto fijo.

| Código | Tipo | Cuándo ocurre | Motivo y acción |
| --- | --- | --- | --- |
| `UPSTREAM_RATE_LIMITED` | `quota` | El servicio de facturación responde HTTP 429. | Se alcanzó un límite temporal de solicitudes. El ticket queda fallido. `retryable: true`: esperar unos minutos y enviar un ticket nuevo. |
| `UPSTREAM_AUTH_ERROR` | `auth` | El servicio responde HTTP 401 o 403. | Falló el acceso del servicio de facturación. Contactar a soporte; este código no significa que la llave API del cliente sea inválida. |
| `UPSTREAM_UNAVAILABLE` | `upstream` | El servicio responde HTTP 5xx. | El servicio rechazó el envío por una falla propia; no lo procesó. `retryable: true`. |
| `UPSTREAM_UNAVAILABLE` | `connection` | Hay un error de conexión, se agota la espera del envío, se recibe HTTP 408, o el ticket quedó 30 minutos en `processing`. | No se obtuvo una respuesta a tiempo. La espera de red configurada para el envío es de 30 segundos. `retryable: false`: revisar el estado antes de duplicar la solicitud. |
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
| `PROVIDER_TIMEOUT` | `upstream` | Un ticket aceptado (`pending`) no recibe resultado final en 24 horas. | `failed`, con `ticket.failed` e `invoice.failed`. `retryable: false`. No confundir con los 30 segundos de espera de una petición de envío. |
| `SERVICE_UNAVAILABLE` | `unavailable` | El ticket no avanzó de `received` o `queued` en 30 minutos. | `failed`, con `ticket.failed`. Nunca se envió a facturar: se devuelve el crédito. `retryable: true`. |
| `IMAGE_MISSING` | `validation` | La imagen no está disponible en almacenamiento al intentar el envío. | `failed`, con `ticket.failed`. `retryable: true`. |
| `INTAKE_FAILED` | `internal` | Falla la preparación o persistencia después de registrar el ticket. | `failed`, con `ticket.failed`. Se devuelve el crédito. `retryable: true`. |
| `TEST_SCENARIO_FAILED` | `test` | Una prueba de sandbox solicita una falla. | `failed`, con eventos de falla. No representa una facturación real. |

## Disponibilidad del servicio

`GET /api/v1/status` (llave con alcance `read`) responde:

```json
{
  "status": "operational | degraded | down",
  "components": {
    "ingest": { "status": "operational", "reason": null },
    "extraction": { "status": "down", "reason": "El procesamiento de tickets está detenido." },
    "invoicing": { "status": "operational", "reason": null }
  },
  "retry_after_seconds": 60,
  "livemode": true,
  "updated_at": "2026-11-03T17:58:44.000Z",
  "request_id": "req_ejemplo"
}
```

El estado se mide con resultados reales de los últimos minutos, no con un ping del proceso HTTP:

| Componente | `degraded` | `down` |
| --- | --- | --- |
| `ingest` | — | No se puede leer ni escribir en la base de datos. |
| `extraction` | Un ticket listo espera más de 1 minuto en la cola, o no hay datos del procesador. | El procesador de tickets no reporta actividad en 90 segundos, o un ticket espera más de 5 minutos. |
| `invoicing` | Al menos 20 % de los intentos de los últimos 10 minutos (mínimo 3) fallaron por indisponibilidad del servicio (`UPSTREAM_UNAVAILABLE`, `UPSTREAM_INVALID_RESPONSE`, `UPSTREAM_AUTH_ERROR`, `UPSTREAM_RATE_LIMITED`, `INSUFFICIENT_BALANCE`, `PROVIDER_TIMEOUT`), o hubo un límite temporal. | Al menos 50 % de esos intentos fallaron. |

`status` es el peor de los componentes. Los errores de datos y los no facturables no cuentan como indisponibilidad. Con `down`, `POST /api/v1/tickets` responde 503; con `degraded`, acepta con `delayed: true`. Un 5xx o timeout de `/api/v1/status` también debe tratarse como `down`.

Un operador puede declarar un incidente o apagar un componente con `pnpm service:override set <live|test> <componente> <down|degraded> "<motivo>" [minutos]` y retirarlo con `pnpm service:override clear <live|test> [componente]`. El motivo es público: escribirlo en español y sin nombres de proveedores. Una declaración solo puede empeorar el estado medido. Las llaves de prueba solo ven las declaraciones del modo `test`; así se puede ejecutar en sandbox la prueba de «extracción apagada» sin afectar producción.

### Webhooks de incidente

`service.degraded`, `service.down` y `service.recovered` se envían al mismo endpoint y con la misma firma que los demás eventos, una vez por cambio de estado. Se calculan en el worker, en el webhook router (para detectar un worker detenido) y en cada llamada a la API, cada 15 segundos como máximo. Se activan suscribiendo el endpoint a esos eventos.

```json
{
  "type": "service.down",
  "livemode": true,
  "data": {
    "object": {
      "object": "service_status",
      "status": "down",
      "previous_status": "operational",
      "components": { "extraction": { "status": "down", "reason": "El procesamiento de tickets está detenido." } },
      "retry_after_seconds": 60,
      "changed_at": "2026-11-03T17:58:44.000Z",
      "updated_at": "2026-11-03T17:58:44.000Z"
    }
  }
}
```

## Tiempo máximo por estado (SLA)

| Estado | Tiempo máximo | Al vencer |
| --- | --- | --- |
| `received`, `queued` | 30 minutos sin avanzar | `failed` con `SERVICE_UNAVAILABLE` (`retryable: true`), `ticket.failed` y devolución del crédito. |
| `processing` | 30 minutos desde que inició el envío | `failed` con `UPSTREAM_UNAVAILABLE` tipo `connection` (`retryable: false`), `ticket.failed`. |
| `pending` (aceptado por el servicio de facturación) | 24 horas | `failed` con `PROVIDER_TIMEOUT` (`retryable: false`), `ticket.failed` e `invoice.failed`. |

El cierre lo ejecuta cualquiera de los procesos anteriores, así que también ocurre si el worker está detenido.

## Reintentos idempotentes

Reintentar `POST /api/v1/tickets` con el mismo `Idempotency-Key` y el mismo cuerpo, después de un 503, un 5xx o un timeout, **nunca crea un segundo ticket ni cobra dos veces**:

- Si el primer intento creó el ticket, se devuelve ese mismo ticket con HTTP 201 y el header `Idempotent-Replayed: true`, aunque el servicio esté caído en ese momento.
- Si el primer intento no lo creó (503, error antes de confirmar), el reintento lo crea normalmente.
- Las solicitudes simultáneas con la misma llave se serializan: una crea el ticket y las demás lo reciben.
- El cobro del crédito, el ticket y el registro de idempotencia se guardan en una sola transacción: si algo falla, no queda nada a medias.
- La misma llave con otro cuerpo responde HTTP 409 `idempotency_key_reused`.

La llave identifica la solicitud de creación; no reactiva un ticket que ya falló. Para enviar de nuevo una compra cuyo ticket falló con `retryable: true`, usar una llave nueva.

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
        "message": "El servicio de facturación alcanzó su límite temporal de solicitudes. Intenta de nuevo en unos minutos.",
        "retryable": true
      }
    }
  }
}
```

La interfaz muestra «No facturable» para `not_invoiceable` y «No se pudo facturar el ticket» para `failed`, conservando el motivo y el código. Para un límite temporal también aclara que el ticket no se reenviará automáticamente. Un tiempo de espera recibido se conserva para diagnóstico y no constituye una programación de reenvío ni una garantía de disponibilidad futura.

## Cómo debe actuar una integración

1. Revisar el HTTP de la operación. Si hay un error de API, usar `code`, `param` y `request_id` para corregirlo o escalarlo. Con `retryable: true` (503, 5xx, timeout), esperar `Retry-After` y repetir con el mismo `Idempotency-Key` y el mismo cuerpo.
2. Suscribirse a `service.down`, `service.degraded` y `service.recovered`, o consultar `GET /api/v1/status`, para avisar a los usuarios y pausar envíos durante un incidente.
3. Después de un HTTP 201, conservar el identificador del ticket y esperar el webhook o consultar su estado. Si llega `delayed: true`, avisar que tardará más.
4. Al recibir `ticket.failed`, mostrar `error.message` al usuario. Con `retryable: true`, la compra puede enviarse de nuevo como un ticket nuevo; con `false`, corregir los datos o, en fallas de conexión, verificar primero si hubo procesamiento.
5. Para soporte, compartir el identificador del ticket, código, mensaje, hora del incidente y `request_id` si existe. No incluir llaves API ni credenciales.

Repetir la creación con la misma llave de idempotencia recupera la respuesta de recepción guardada; no reactiva un ticket fallido. Crear una nueva solicitud live consume otro crédito. Solo se devuelve automáticamente el crédito de tickets que nunca se enviaron a facturar (`SERVICE_UNAVAILABLE` por SLA e `INTAKE_FAILED`).

## Métricas de facturación

`GET /api/v1/stats` conserva todos los tickets en `tickets.total` y `tickets.by_status`, incluyendo `not_invoiceable` como categoría independiente. Las tasas de salud usan únicamente resultados evaluables:

- `tickets.success_rate = finalized / (finalized + failed)`.
- `tickets.error_rate = failed / (finalized + failed)`.
- Los no facturables, activos y cancelados no forman parte del denominador. Si no hay resultados evaluables, ambas tasas son `0`.

Las tasas son fracciones entre 0 y 1. Esto cambia el denominador anterior de `error_rate`, que incluía todos los tickets. El resumen del dashboard muestra la tasa de éxito como porcentaje y «—» si no hay resultados evaluables. Los conteos de fallidos y no facturables se muestran por separado. Las métricas HTTP de la API siguen midiendo respuestas HTTP.

`pnpm db:push` y `pnpm db:migrate` ejecutan el backfill después de confirmar el cambio de esquema. También puede repetirse con `pnpm db:backfill-not-invoiceable`. Reclasifica únicamente tickets `failed` con `error_code = 'NOT_INVOICEABLE'`; conserva motivos, fechas y payloads históricos y no reenvía webhooks.
