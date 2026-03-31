# HOUSEHOLD RESOLUTION FIX

Fecha de cierre del bloque: 2026-03-31  
Ámbito: resolución del household actual, normalización mínima del caso real, endurecimiento v1 en código  
Nota: los ids y correos exactos del caso real quedaron fuera del repo. La evidencia completa vive solo en `tmp/` local.

## Causa raíz exacta

La app y parte del backend resolvían el household actual con un patrón implícito:

- `household_members where user_id = ? and invitation_status = 'accepted' limit 1`

Ese patrón tenía dos fallas estructurales:

1. dependía del orden accidental de filas devueltas por la base  
2. no expresaba ninguna regla de producto para usuarios con múltiples memberships aceptadas

En el caso real:

- el owner tenía varias memberships aceptadas, pero caía por azar en el household premium compartido correcto
- la miembro invitada tenía:
  - una membership `member` en el household premium compartido
  - otra membership `owner` en un household vacío/inactivo
- la query actual devolvía ese household incorrecto, por eso la app le mostraba `base / inactive`

La inconsistencia no estaba en el plan premium real, sino en la forma de resolver **qué household era el actual**.

## Regla implementada

Compás Hogar v1 queda explícitamente definido como:

- **un solo hogar operativo por usuario**

Regla determinista aplicada en código:

1. si el usuario no tiene memberships aceptadas, no hay household actual
2. si tiene exactamente un household aceptado con suscripción activa, ese es el household actual
3. si no hay uno activo, pero existe un único household aceptado, ese es el household actual
4. si existen múltiples households aceptados sin un único activo, el sistema marca inconsistencia y no resuelve silenciosamente al azar
5. si existen múltiples households activos, también marca inconsistencia

Esto elimina la dependencia en `limit(1)` y en el orden implícito de filas.

## Nueva estructura aplicada

### Frontend

Se extrajo la regla a un módulo puro compartido:

- `shared/household-resolution.ts`

El hook:

- `src/hooks/useHousehold.tsx`

ahora:

- carga todas las memberships aceptadas del usuario
- carga households y subscriptions relacionados
- aplica la regla determinista
- devuelve error explícito si encuentra inconsistencia

### Backend en repo

Se alinearon las funciones que resolvían “tu hogar” por orden implícito:

- `supabase/functions/manage-invitation/index.ts`
- `supabase/functions/manage-household-member/index.ts`
- `supabase/functions/manage-household-settings/index.ts`
- `supabase/functions/accept-invitation/index.ts`

Se agregó helper compartido:

- `supabase/functions/_shared/current-household.ts`

Ese helper usa la misma regla de resolución para no duplicar lógica divergente.

### Base de datos en repo

Se dejó preparada una migración de endurecimiento:

- `supabase/migrations/20260331103000_household_resolution_v1.sql`

Incluye:

- función `resolve_current_household_context(...)`
- ajuste de `create_household_setup(...)`
- índice único parcial para evitar más de un household aceptado por usuario

## Normalización de datos ejecutada

Se auditó y normalizó el caso real afectado.

Cambio ejecutado:

- se eliminaron **3 households fantasma** vacíos, todos con:
  - una sola membership owner
  - suscripción `base / inactive`
  - sin transacciones
  - sin recurrencias
  - sin calendario
  - sin metas
  - sin reviews mensuales
  - sin imports
  - sin invitaciones pendientes
  - solo categorías por defecto

Resultado:

- owner real quedó con un único household aceptado: el compartido premium
- miembro invitado real quedó con un único household aceptado: el mismo compartido premium
- ya no quedan households fantasma interfiriendo en la resolución del caso real

## Evidencia final

| Caso | Estado | Evidencia | Riesgo residual | ¿Bloquea salida comercial? |
| --- | --- | --- | --- | --- |
| La causa raíz quedó identificada | PASS | Se reprodujo el fallo real: la miembro invitada resolvía otro household `owner` con `base / inactive` por `limit(1)` implícito | Ninguno relevante | no |
| La regla de resolución quedó explícita en código | PASS | `shared/household-resolution.ts` define una única regla para frontend y backend en repo | La migración equivalente en BD quedó pendiente de aplicar | no |
| El hook del frontend ya no depende de orden accidental | PASS | `useHousehold()` ahora evalúa todas las memberships aceptadas y resuelve con regla determinista | Mientras no se despliegue el frontend nuevo, la producción sigue usando la versión previa | no |
| El caso real del owner quedó coherente | PASS | El owner real ahora tiene un único household aceptado y sigue viendo `plus / active / monthly` | Bajo | no |
| El caso real del miembro invitado quedó coherente | PASS | La invitada real ya resuelve el mismo household compartido y la misma suscripción `plus / active / monthly` | Bajo | no |
| Ya no quedan households fantasma interfiriendo en el caso real | PASS | Los 3 households vacíos auditados fueron eliminados con preflight y post-check | Bajo | no |
| La app puede seguir cayendo al azar cuando existan múltiples memberships aceptadas | PASS para el frontend, PARTIAL a nivel de sistema | El frontend nuevo ya no cae al azar; además el helper backend y la migración quedaron en repo | Las edge functions y la migración aún no están desplegadas en Supabase | no |
| La prevención estructural para nuevos duplicados quedó activa en producción | PARTIAL | Existe migración con función e índice único parcial | La garantía en BD no quedó aplicada en vivo en esta fase | no |

## Qué se cambió exactamente

Archivos modificados:

- `package.json`
- `src/hooks/useHousehold.tsx`
- `src/types/database.ts`
- `shared/household-resolution.ts`
- `tests/household-resolution.test.ts`
- `supabase/functions/_shared/current-household.ts`
- `supabase/functions/accept-invitation/index.ts`
- `supabase/functions/manage-household-member/index.ts`
- `supabase/functions/manage-household-settings/index.ts`
- `supabase/functions/manage-invitation/index.ts`
- `supabase/migrations/20260331103000_household_resolution_v1.sql`

## Pruebas ejecutadas

Pruebas locales:

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

Pruebas reales con evidencia viva:

- auditoría del estado real antes del fix
- preflight exacto de los 3 households fantasma
- normalización real de esos 3 households
- post-check confirmando borrado
- verificación real posterior:
  - owner resuelve household compartido premium correcto
  - miembro invitado resuelve exactamente el mismo household
  - ambos ven `plus / active / monthly`

## Riesgos residuales

1. la migración SQL de endurecimiento no quedó aplicada en producción en esta fase  
2. las edge functions alineadas quedaron corregidas en repo, pero no quedaron desplegadas a Supabase en esta fase  
3. la prevención total de nuevos duplicados todavía depende de desplegar esa capa de backend/BD  

## Veredicto final del bloque

**PASS con riesgo residual documentado**

Qué sí quedó cerrado:

- el caso real que bloqueaba la salida dejó de ser inconsistente
- owner e invitada ahora resuelven el mismo hogar compartido premium
- la regla v1 quedó explícita y ya no depende de lucky ordering en el frontend nuevo

Qué no quedó cerrado del todo:

- la garantía estructural en Supabase aún requiere aplicar la migración y desplegar las edge functions alineadas

## Siguiente acción mínima correcta

Sin expandir alcance:

1. desplegar a Supabase las edge functions tocadas
2. aplicar la migración `20260331103000_household_resolution_v1.sql`
3. rerun breve de validación real para confirmar que la garantía v1 ya quedó también en backend y BD
