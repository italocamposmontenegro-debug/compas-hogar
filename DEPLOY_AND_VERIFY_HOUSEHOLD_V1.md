# Deploy And Verify Household V1

## Alcance
Se cerró únicamente el endurecimiento pendiente del fix `household resolution v1`:

1. deploy de edge functions afectadas,
2. aplicación de la migración SQL en producción,
3. verificación real y reproducible de la garantía v1 en backend + base de datos.

## Comandos ejecutados

### Vinculación y acceso
```powershell
npx supabase link --project-ref eukyxyahcxfnlexowepm --yes
npx supabase db query "select 1 as ok" --linked -o json
```

### Deploy de edge functions
```powershell
npx supabase functions deploy accept-invitation --project-ref eukyxyahcxfnlexowepm --use-api
npx supabase functions deploy manage-invitation --project-ref eukyxyahcxfnlexowepm --use-api
npx supabase functions deploy manage-household-member --project-ref eukyxyahcxfnlexowepm --use-api
npx supabase functions deploy manage-household-settings --project-ref eukyxyahcxfnlexowepm --use-api
```

### Intentos de migración y corrección
```powershell
npx supabase db query --linked -f "C:\Users\ica_r\OneDrive\Documentos\Playground\compas-hogar\supabase\migrations\20260331103000_household_resolution_v1.sql" -o json
npx supabase db query --linked "select pg_get_functiondef('public.create_household_setup(text,text,integer,text,integer,date,text)'::regprocedure) as definition" -o json
npx supabase db query --linked -f "C:\Users\ica_r\OneDrive\Documentos\Playground\compas-hogar\supabase\migrations\20260331103000_household_resolution_v1.sql" -o json
```

### Verificación final
```powershell
npx supabase db query --linked -f "C:\Users\ica_r\OneDrive\Documentos\Playground\compas-hogar\tmp\verify_household_resolution_v1.sql" -o json
```

## Incidentes encontrados durante el cierre

### 1. La migración no entró limpia al primer intento
- **Síntoma:** `cannot change return type of existing function`
- **Causa:** en producción, `public.create_household_setup(...)` seguía retornando `uuid`; la migración del repo la redefinía a `jsonb`.
- **Corrección aplicada:** se agregó `DROP FUNCTION IF EXISTS public.create_household_setup(TEXT, TEXT, INTEGER, TEXT, INTEGER, DATE, TEXT);` antes de recrearla.

### 2. La función SQL quedó creada pero fallaba al ejecutarse
- **Síntoma:** `column reference "subscription_status" is ambiguous`
- **Causa:** la función `resolve_current_household_context(uuid)` retornaba columnas con nombres que colisionaban con referencias no calificadas dentro del `plpgsql`.
- **Corrección aplicada:** se calificaron las referencias con alias (`ac.subscription_status`, `ac.membership_id`, etc.) y se reaplicó la migración.

## Resultado de verificaciones obligatorias

| Verificación | Estado | Evidencia | Riesgo residual |
| --- | --- | --- | --- |
| 1. Owner resuelve el household compartido premium correcto | PASS | `resolve_current_household_context('2945b942-2d1e-4c85-b164-82b9c666478d')` devolvió `household_id = 55bc9b54-3bf2-468a-974d-3a452ce44a5b`, `resolution_reason = single_active_subscription` | bajo |
| 2. Miembro invitado resuelve exactamente el mismo household | PASS | `resolve_current_household_context('1889884a-746a-491f-8265-a974a37d1602')` devolvió el mismo `household_id = 55bc9b54-3bf2-468a-974d-3a452ce44a5b` | bajo |
| 3. Ambos ven `plus / active / monthly` | PASS | owner e invitada resolvieron `subscription_plan_code = plus`, `subscription_status = active`, `subscription_billing_cycle = monthly` | bajo |
| 4. La resolución ya no depende del orden accidental de filas | PASS | en producción existe `public.resolve_current_household_context(uuid)` y `resolve_fn_has_deterministic_guards = true`; además existe `idx_household_members_single_operational_household` | bajo |
| 5. `accept-invitation` y funciones relacionadas usan la nueva regla backend | PASS | se desplegaron en producción `accept-invitation`, `manage-invitation`, `manage-household-member` y `manage-household-settings`; el bundle desplegado incluyó `supabase/functions/_shared/current-household.ts`, y `create_household_setup_uses_resolution = true` quedó verificado en BD | bajo |
| 6. No aparecen households fantasma o subscriptions `base / inactive` interfiriendo en el caso real | PASS | `owner_accepted_memberships` y `member_accepted_memberships` devolvieron una sola membership aceptada cada uno, ambas sobre `CamposGraf`, con suscripción `plus / active / monthly` | bajo |
| 7. Backend + BD quedaron alineados con el fix del repo | PASS | functions desplegadas + migración aplicada + verificación SQL final `resolve_fn_exists = true`, `single_operational_household_index_exists = true`, `create_household_setup_uses_resolution = true` | bajo |

## Evidencia concreta

### Verificación SQL final
La ejecución de `tmp/verify_household_resolution_v1.sql` devolvió:

- `resolve_fn_exists = true`
- `resolve_fn_has_deterministic_guards = true`
- `create_household_setup_uses_resolution = true`
- `single_operational_household_index_exists = true`

### Owner
- `household_id = 55bc9b54-3bf2-468a-974d-3a452ce44a5b`
- `household_name = CamposGraf`
- `role = owner`
- `subscription_plan_code = plus`
- `subscription_status = active`
- `subscription_billing_cycle = monthly`
- `accepted_household_count = 1`
- `active_household_count = 1`
- `resolution_reason = single_active_subscription`

### Miembro invitado
- `household_id = 55bc9b54-3bf2-468a-974d-3a452ce44a5b`
- `household_name = CamposGraf`
- `role = member`
- `subscription_plan_code = plus`
- `subscription_status = active`
- `subscription_billing_cycle = monthly`
- `accepted_household_count = 1`
- `active_household_count = 1`
- `resolution_reason = single_active_subscription`

## Riesgos residuales

1. El bloque `household resolution v1` quedó cerrado en producción, pero sigue existiendo una deuda de operación del repositorio:
   - `supabase db push --linked --dry-run` mostró divergencia entre migraciones remotas y locales históricas.
   - Para este cierre se usó una aplicación dirigida con `db query -f`.
2. No fue necesario tocar más datos productivos en esta fase.
3. No se reabrió billing, monthly review, correos ni UX secundaria.

## Veredicto del bloque

**PASS backend+BD cerrado**

La garantía v1 quedó efectiva también en backend y base de datos:

- la resolución actual del hogar ya no depende del orden accidental de filas,
- owner e invitada resuelven exactamente el mismo hogar premium compartido,
- el plan leído por ambos es `plus / active / monthly`,
- las funciones desplegadas y la base de datos quedaron alineadas con el fix del repo.
