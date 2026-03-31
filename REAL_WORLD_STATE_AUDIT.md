# REAL WORLD STATE AUDIT

Fecha de auditoría: 2026-03-31  
Ámbito: billing, invitaciones, household compartido, admin mínimo, auth/email relacionados  
Fuente: evidencia viva en Supabase + sesiones reales temporales generadas sin cambiar contraseñas + lectura del código desplegado  
Nota: este documento redacta emails e ids sensibles. La evidencia completa quedó solo en `tmp/` local y no se subió al repo.

## 1. Escenario real auditado

Se auditó un household real compartido con estas señales concurrentes:

- household compartido con 2 memberships aceptadas
- suscripción local `plus / active / monthly`
- `last_payment_status = authorized`
- una invitación aceptada asociada al email de la pareja
- uso real de funciones premium en ese household

Identificadores redactados:

- Household compartido: `55bc9b…4a5b`
- Subscription local: `eea3a6…72c0`
- Provider subscription id: `d6b486…1b5b`
- Owner: `it***o@gmail.com`
- Miembro invitado: `in***s@gmail.com`

## 2. Estado real del household y la suscripción

### Household compartido

- Nombre: `CamposGraf`
- Creado: `2026-03-21T02:31:37Z`
- Miembros aceptados: `2`
- Memberships aceptadas en este household:
  - owner
  - member

### Suscripción del household compartido

- `plan_code = plus`
- `billing_cycle = monthly`
- `status = active`
- `provider = mercadopago`
- `provider_account_label = mp_default`
- `provider_subscription_id = d6b486…1b5b`
- `price_amount_clp = 4990`
- `last_payment_status = authorized`
- `current_period_start = null`
- `current_period_end = null`
- `updated_at = 2026-03-25T12:35:54Z`

### Lectura de plan en la app

Con la lógica actual:

- `status === active` => el household se interpreta como pagado
- `plan_code === plus` => el plan se interpreta como `strategic`

En este household eso significa:

- owner: debería ver premium
- miembro invitado: debería ver premium solo si la app resuelve este household como actual

## 3. Estado real de la invitación ya usada

Se encontró una invitación histórica aceptada para el email de la pareja:

- Invitation token: `a9f18e…f6df`
- Email invitado: `in***s@gmail.com`
- `status = accepted`
- `created_at = 2026-03-25T02:38:34Z`
- `accepted_at = 2026-03-25T02:39:57Z`

Conclusión dura:

- Sí hay evidencia real de token aceptado.
- No hay evidencia suficiente para afirmar que la aceptación quedó validada por email transaccional real.
- No hay delivery logs persistidos en BD.
- Por lo tanto, el flujo históricamente probado es:
  - **invitación válida + aceptación real del token**
  - **no demostración de entrega por correo**

## 4. Respuesta explícita a las preguntas críticas

### 4.1. ¿Cómo llegó la suscripción a `active`?

No quedó demostrado de forma trazable.

Hechos reales:

- hoy la fila local está en `active`
- el `provider_subscription_id` existe
- `last_payment_status = authorized`
- el household real usa funciones premium

Pero falta trazabilidad histórica:

- no hay `subscription_events` para esa suscripción
- no hay `webhook_events` asociados a ese provider id

Conclusión:

- **No se puede afirmar con evidencia suficiente si el `active` llegó por webhook real, sync posterior, escritura manual o un flujo híbrido anterior a la instrumentación actual.**
- Solo se puede afirmar que **el estado actual local y el uso premium son consistentes entre sí**.

### 4.2. ¿La invitación de la pareja quedó validada vía email real o solo vía enlace/manual?

No quedó demostrado por correo.

Sí quedó demostrado:

- token histórico aceptado
- membership `member` creada y aceptada

No quedó demostrado:

- envío SMTP real
- apertura desde correo real

Conclusión:

- **Aceptación real del enlace/token: sí**
- **entrega por correo real: no probada**

### 4.3. ¿El household shared actual refleja correctamente permisos y plan?

En base de datos: **sí**.  
En resolución actual de la app para ambos usuarios: **no**.

Detalle:

- el owner tiene membership aceptada en el household compartido y la app actualmente resuelve ese mismo household como actual
- la pareja tiene membership aceptada en el household compartido, pero también tiene otro household donde figura como owner
- la app hoy resuelve el household actual con esta consulta:
  - `household_members where user_id = ? and invitation_status = 'accepted' limit 1 maybeSingle()`
- esa consulta no tiene selector de household ni criterio estable

Resultado observado:

- owner actual: cae en el household compartido premium
- miembro invitado actual: cae en su otro household `owner`, que tiene una suscripción `base / inactive / 0`

Conclusión:

- **El modelo de permisos del household compartido existe**
- **pero la app no sostiene correctamente el escenario real de hogar compartido cuando un usuario tiene más de una membership aceptada**

## 5. Validación real del household compartido

## Fase B — resultado

### Owner

La sesión real temporal del owner resolvió:

- household actual: compartido `55bc9b…4a5b`
- subscription actual: `plus / active / monthly`

Estado: **PASS**

### Miembro invitado

La sesión real temporal del miembro resolvió:

- household actual de la app: otro household donde figura como owner
- subscription actual de la app: `base / inactive / monthly / 0`
- household compartido premium: existe, pero no es el que la app toma como actual

Estado: **FAIL**

### Implicancia

El caso real compartido hoy no está comercialmente cerrado.

Aunque el household premium compartido existe en BD, la app no garantiza que el miembro invitado entre al household correcto ni herede el plan correcto si tiene múltiples memberships aceptadas.

## 6. Premium real visible en el household auditado

Se confirmó presencia de uso premium en el household compartido:

- recurrencias activas: `1`

Eso confirma que el household premium no es solo una fila activa en `subscriptions`; sí tiene uso funcional real.

## 7. Estado real de admin

Resultado vivo:

- no apareció ningún `profiles.is_admin = true`
- por lo tanto no hubo usuario real capaz de invocar `admin-overview` en producción

Conclusión:

- la función `admin-overview` existe en código
- pero hoy **no quedó demostrada como accesible para un operador real en producción**
- a nivel operativo esto deja observabilidad útil, pero no necesariamente usable

## 8. Flujos que NO se siguieron validando por bloqueo previo

No se continuó a validaciones adicionales de:

- recovery/reset real por correo
- verificación de correo real end-to-end
- webhook/activación aprobada histórica
- cancelación sobre la cuenta activa principal

Razón:

- apareció un **P0 funcional en el escenario real compartido**
- avanzar como si la salida comercial estuviera cerca habría sido engañoso

## 9. Tabla final

| Caso | Estado | Evidencia | Riesgo residual | ¿Bloquea salida comercial? |
| --- | --- | --- | --- | --- |
| Existe una suscripción real activa | PASS | Household `55bc9b…4a5b` con `plus / active / monthly`, `price_amount_clp=4990`, `last_payment_status=authorized` | Sigue faltando traza histórica del momento exacto de activación | no |
| Existe un hogar compartido real con 2 miembros aceptados | PASS | 2 memberships aceptadas en el mismo household, owner + member | El modelo existe, pero no garantiza resolución correcta en app | no |
| La invitación real quedó aceptada | PASS | `invitation_tokens.status = accepted` con `accepted_at` poblado para la pareja | No demuestra envío/entrega por correo | no |
| La invitación quedó validada por correo real | PARTIAL | No hay delivery logs ni evidencia de SMTP real | El flujo histórico puede haber sido manual por enlace | no |
| El owner resuelve el household compartido correcto | PASS | La consulta real equivalente a `useHousehold()` devuelve el household compartido premium | Tiene otras memberships, pero hoy cae en la correcta por accidente o por orden actual | no |
| El miembro invitado resuelve el household compartido correcto | FAIL | La consulta real equivalente a `useHousehold()` devuelve su otro household `owner`, no el compartido | Ve un hogar Free/inactive en vez del premium compartido | sí |
| El plan premium del household compartido se interpreta correctamente para el owner | PASS | `current_app_subscription = plus / active` para el owner | Ninguno relevante en este caso puntual | no |
| El plan premium del household compartido se interpreta correctamente para el miembro invitado | FAIL | `current_app_subscription = base / inactive` para el miembro, porque la app resuelve otro household | La pareja no recibe consistentemente el acceso correcto del hogar compartido | sí |
| La trazabilidad histórica de activación está cerrada | FAIL | No hay `subscription_events` ni `webhook_events` para esa suscripción histórica | No se puede asegurar cómo llegó a `active` | sí |
| Admin mínimo está operativo para un operador real | FAIL | No se encontró ningún usuario con `profiles.is_admin = true` | `admin-overview` puede existir pero no estar utilizable en vivo | sí |

## 10. Veredicto real

**NO GO**

Razones suficientes:

1. el caso real compartido no queda sostenido correctamente para el miembro invitado  
2. la representación histórica del `active` no tiene trazabilidad suficiente  
3. admin mínimo no quedó operable para un usuario real  

## 11. Siguiente paso mínimo correcto

No agregar features.

Hacer solo esto, en este orden:

1. definir y corregir la regla de household actual cuando un usuario tiene múltiples memberships aceptadas  
2. decidir si el producto soporta múltiples hogares por usuario o si debe impedirlos  
3. normalizar datos reales afectados antes de seguir validando comercialmente  
4. recién después revalidar el hogar compartido real y la lectura del plan para ambos usuarios  
5. luego retomar recovery/email/webhook/cancelación sobre escenario estable
