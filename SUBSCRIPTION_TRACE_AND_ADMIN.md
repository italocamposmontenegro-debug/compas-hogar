# Subscription Trace And Admin

Fecha de cierre: 2026-04-01

## Alcance

Este cierre cubre solo:

1. trazabilidad real de una suscripción activa,
2. admin mínimo operativo real,
3. preparación segura para cancelación sobre activa.

No reabre recovery, invitaciones, billing UX, household resolution ni monthly review.

## Estado real auditado

### Suscripción activa comercial real

Caso auditado:

- `subscription_id`: `eea3a63a-5eb2-43b4-bcb4-d367f30072c0`
- `household_id`: `55bc9b54-3bf2-468a-974d-3a452ce44a5b`
- `household_name`: `CamposGraf`
- `owner_email`: `italo.campos.montenegro@gmail.com`
- `plan_code`: `plus`
- `status`: `active`
- `billing_cycle`: `monthly`
- `provider`: `mercadopago`
- `provider_account_label`: `mp_default`
- `provider_subscription_id`: `d6b486dcf41f42f8927fec9fff6d1b5b`
- `external_reference`: `55bc9b54-3bf2-468a-974d-3a452ce44a5b`
- `last_payment_status`: `authorized`
- `price_amount_clp`: `4990`
- `created_at`: `2026-03-21T02:31:37.704666+00:00`
- `updated_at`: `2026-03-25T12:35:54.190663+00:00`

Members aceptados del hogar real:

- owner: `2945b942-2d1e-4c85-b164-82b9c666478d` / `italo.campos.montenegro@gmail.com`
- member: `1889884a-746a-491f-8265-a974a37d1602` / `ingegrafs@gmail.com`

### Qué trazabilidad sí existe hoy

Existe evidencia operativa suficiente para afirmar el estado actual:

- la fila real en `public.subscriptions`,
- el household asociado en `public.households`,
- los memberships aceptados en `public.household_members`,
- la visualización del caso en `admin-overview`.

Eso permite a soporte explicar con precisión:

- qué hogar está activo,
- qué plan tiene,
- qué ciclo usa,
- qué provider id sostiene la suscripción,
- cuál fue el último estado de pago persistido.

### Qué trazabilidad falta para reconstruir el lifecycle

Para esta suscripción comercial real específica hoy no existe trazabilidad histórica completa:

- `subscription_events` para `eea3a63a-5eb2-43b4-bcb4-d367f30072c0`: `0`
- `webhook_events` con `resource_id = d6b486dcf41f42f8927fec9fff6d1b5b`: `0`

Conclusión operativa:

- sí se puede diagnosticar el estado actual,
- no se puede reconstruir con evidencia interna el paso histórico exacto a `active` para esta referencia comercial específica.

## Admin mínimo operativo real

### Estado inicial

Antes de esta iteración:

- `profiles.is_admin = true`: `0` filas

### Cambio mínimo aplicado

Se habilitó un admin mínimo real y utilizable en una cuenta segura existente de operación:

- `profile_id`: `6a254fea-e805-4733-957a-da9ea731f86b`
- `email`: `beta1@compashogar.local`
- `full_name`: `Beta Tester 1`
- cambio aplicado: `profiles.is_admin = true`

No se tocó la cuenta activa principal.

### Verificación de admin-overview

Se verificó login real con la cuenta admin habilitada y luego invocación exitosa de `admin-overview`.

Resultado comprobado:

- `households_count`: `16`
- `webhook_events_count`: `1`
- `subscription_events_count`: `0`

La respuesta de `admin-overview` incluye el caso comercial real:

- `household_id`: `55bc9b54-3bf2-468a-974d-3a452ce44a5b`
- `household_name`: `CamposGraf`
- `members_count`: `2`
- `owner_name`: `Italo`
- `owner_email`: `italo.campos.montenegro@gmail.com`
- `plan_code`: `plus`
- `billing_cycle`: `monthly`
- `subscription_status`: `active`
- `price_amount_clp`: `4990`
- `provider_subscription_id`: `d6b486dcf41f42f8927fec9fff6d1b5b`

Conclusión:

- ya existe acceso admin real y utilizable,
- ya se puede diagnosticar un caso básico de suscripción sin entrar ciegamente a la base.

## Preparación segura para cancelación sobre activa

### Inventario actual de suscripciones activas

Activas detectadas:

1. `CamposGraf`  
   `subscription_id = eea3a63a-5eb2-43b4-bcb4-d367f30072c0`  
   `provider_subscription_id = d6b486dcf41f42f8927fec9fff6d1b5b`

2. `Hogar Demo 1`  
   `provider_subscription_id = beta-testers-final-2026-subscription-1`

3. `Hogar Demo 2`  
   `provider_subscription_id = beta-testers-final-2026-subscription-2`

4. `Hogar Demo 3`  
   `provider_subscription_id = beta-testers-final-2026-subscription-3`

### Determinación de cuenta sacrificable

No existe hoy una cuenta activa sacrificable y realmente válida para probar cancelación sobre activa con evidencia comercial real.

Razón:

- la suscripción de `CamposGraf` es la única referencia claramente real y vigente con provider id de Mercado Pago,
- las tres activas de `Hogar Demo` son seeds de beta y sus `provider_subscription_id` son sintéticos, no aptos para demostrar cancelación real contra el provider.

Por decisión segura:

- no se cancela `CamposGraf` en esta iteración.

### Plan mínimo correcto para la prueba de cancelación sobre activa

1. Crear una cuenta limpia sacrificable.
2. Crear un hogar nuevo y dejarlo owner-only.
3. Ejecutar una compra real controlada del plan mensual.
4. Esperar confirmación real de estado `active`.
5. Verificar en admin:
   - household,
   - plan,
   - status,
   - provider_subscription_id,
   - eventos disponibles.
6. Ejecutar `cancel-subscription` desde la app o función real.
7. Verificar:
   - cambio de `subscriptions.status`,
   - reflejo en UI,
   - efecto en gating,
   - rastro en `subscription_events` y/o `webhook_events`.

## Tabla final

| Caso | Estado | Evidencia | Riesgo residual | ¿Bloquea salida comercial? |
| --- | --- | --- | --- | --- |
| Suscripción activa real identificada con precisión | PASS | fila real `eea3a63a-5eb2-43b4-bcb4-d367f30072c0`, hogar `CamposGraf`, `plus / active / monthly`, `provider_subscription_id = d6b486dcf41f42f8927fec9fff6d1b5b`, `last_payment_status = authorized` | bajo | no |
| Trazabilidad del estado actual utilizable por soporte | PASS | `subscriptions` + `households` + `household_members` + `admin-overview` muestran el caso real de punta a punta | bajo | no |
| Reconstrucción histórica completa del lifecycle de la suscripción activa real | PARTIAL | `subscription_events = 0` y `webhook_events = 0` para la suscripción comercial real | soporte puede explicar estado actual, pero no reconstruir cómo llegó históricamente a `active` | no |
| Admin real habilitado | PASS | antes `0` admins; después `beta1@compashogar.local` con `is_admin = true` | bajo | no |
| Admin mínimo operativo real | PASS | login real + `admin-overview` exitoso + household comercial real visible con plan/status/provider id | bajo | no |
| Existe cuenta activa sacrificable para cancelar sin riesgo | FAIL | solo una activa claramente real; las otras tres son seeds con provider ids sintéticos | cancelación real sobre activa sigue sin prueba segura ejecutable hoy | no |
| Plan seguro de cancelación sobre activa | PASS | quedó definido un procedimiento mínimo, aislado y sin tocar la cuenta principal | requiere una cuenta sacrificable nueva cuando se ejecute | no |

## Qué quedó resuelto

- Se identificó y documentó con precisión la suscripción comercial activa real.
- Se dejó evidencia concreta de qué trazabilidad existe hoy y qué no.
- Se habilitó un admin mínimo real y utilizable.
- Se verificó que el panel admin ya permite ver el caso comercial real sin entrar a ciegas a la base.
- Se dejó un plan exacto y seguro para probar cancelación sobre activa sin destruir la referencia principal.

## Qué sigue pendiente

- La suscripción comercial real activa sigue sin eventos históricos asociados en `subscription_events` o `webhook_events`.
- La cancelación sobre activa real todavía no fue ejecutada porque no existe hoy una cuenta sacrificable segura.

## Siguiente acción mínima correcta

Preparar una cuenta sacrificable nueva con pago real controlado y usarla exclusivamente para:

1. activar una suscripción real,
2. cancelarla,
3. verificar estado, gating y trazabilidad post-cancelación.
