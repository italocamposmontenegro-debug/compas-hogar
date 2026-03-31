# Audit de cierre funcional

Fecha de auditoría: 2026-03-30 / 2026-03-31  
Repositorio: `compas-hogar`  
Entorno validado: producción (`https://compas-hogar.vercel.app`) + Supabase project `eukyxyahcxfnlexowepm`

## Estado real consolidado

| Bloque | Estado real | Riesgo | Archivos involucrados | Qué falta | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Registro | resuelto | Medio | `src/features/auth/index.tsx`, `src/hooks/useAuth.tsx`, Supabase Auth | falta validar correo de confirmación con inbox real | P1 |
| Login | resuelto | Bajo | `src/features/auth/index.tsx`, `src/hooks/useAuth.tsx`, `src/App.tsx` | sin faltantes bloqueantes observados | P2 |
| Logout | resuelto | Bajo | `src/hooks/useAuth.tsx`, `src/components/layout/AppLayout.tsx` | sin faltantes bloqueantes observados | P2 |
| Persistencia de sesión | resuelto | Bajo | `src/hooks/useAuth.tsx`, `src/lib/supabase.ts` | sin faltantes bloqueantes observados | P2 |
| Verificación de email | parcial | Medio | `src/features/auth/index.tsx`, `src/features/auth/VerifyEmailPage.tsx`, Supabase Auth | falta prueba real de click desde correo de verificación | P1 |
| Recuperar/restablecer contraseña | parcial | Medio | `src/features/auth/index.tsx`, `src/hooks/useAuth.tsx` | el restablecimiento funciona, pero `resetPasswordForEmail` quedó rate-limited durante la corrida y no quedó verificado con inbox real | P1 |
| Crear hogar | resuelto | Bajo | `src/features/onboarding/OnboardingPage.tsx`, `supabase/migrations/20260322190000_runtime_fixes.sql` | sin faltantes bloqueantes observados | P2 |
| Unirse a hogar | resuelto | Bajo | `src/features/onboarding/InvitationPage.tsx`, `supabase/functions/accept-invitation/*`, `supabase/functions/preview-invitation/*` | sin faltantes bloqueantes observados | P2 |
| Invitaciones | parcial | Medio | `src/features/settings/SettingsPage.tsx`, `src/features/onboarding/InvitationPage.tsx`, `supabase/functions/manage-invitation/*`, `supabase/functions/_shared/email.ts` | el enlace y aceptación funcionan; el correo transaccional está deshabilitado por falta de SMTP real | P1 |
| Dashboard inicial | parcial | Medio | `src/features/dashboard/DashboardPage.tsx` | falta validación visual end-to-end con datos de producción desde navegador | P2 |
| CRUD de transacciones | resuelto | Bajo | `src/features/transactions/TransactionsPage.tsx`, `supabase/functions/manage-transaction/*` | sin faltantes bloqueantes observados | P2 |
| Categorías | parcial | Medio | `src/features/categories/CategoriesPage.tsx`, `supabase/functions/manage-category/*` | validado create premium y bloqueo post cancelación; falta edición/borrado end-to-end | P2 |
| Metas | parcial | Medio | `src/features/goals/GoalsPage.tsx`, `supabase/functions/manage-goal/*` | validado create y límite Free; falta edición/cierre end-to-end | P2 |
| Resumen mensual | parcial | Medio | `src/features/monthly-review/*`, `supabase/functions/save-monthly-review/*` | no quedó smoke end-to-end con UI real | P1 |
| Recurrencias | parcial | Medio | `src/features/recurring/RecurringPage.tsx`, `supabase/functions/manage-recurring-transaction/*`, `supabase/functions/sync-recurring-items/*` | validado create premium y bloqueo post cancelación; falta ciclo mensual real/generación automática | P1 |
| Plan actual | parcial | Medio | `src/features/subscription/SubscriptionPage.tsx`, `src/hooks/useSubscription.ts`, `src/hooks/useHousehold.tsx` | hogares nuevos aparecen con fila `subscriptions` en `inactive`; la app resuelve Free, pero el origen de esa fila no está trazado en el repo | P1 |
| Gating por plan | parcial | Medio | `shared/plans.ts`, `src/hooks/useSubscription.ts`, edge functions de categorías/recurrencias/metas | validado create premium y bloqueo post cancelación; falta matriz completa por feature y escenarios de impago real | P1 |
| Checkout | parcial | Alto | `supabase/functions/create-subscription/*`, `supabase/functions/update-subscription/*`, `supabase/functions/_shared/subscription.ts`, `supabase/functions/subscription-return/*` | checkout ya inicia; falta pago aprobado end-to-end con evidencia real | P0 |
| Webhook | parcial | Alto | `supabase/functions/mp-webhook/*`, `supabase/functions/_shared/subscription.ts`, `public.webhook_events`, `public.subscription_events` | no quedó evento real de cobro aprobado procesado | P0 |
| Sync de suscripción | parcial | Medio | `supabase/functions/sync-subscription-status/*`, `src/features/subscription/SubscriptionPage.tsx` | validado estado pending; falta approved/failed reales | P1 |
| Cancelación | parcial | Alto | `supabase/functions/cancel-subscription/*`, `src/features/subscription/SubscriptionPage.tsx` | validada cancelación sobre preapproval pending; falta cancelación sobre suscripción cobrada | P0 |
| Admin mínimo | resuelto | Bajo | `src/features/admin/AdminPage.tsx`, `supabase/functions/admin-overview/*` | sin faltantes bloqueantes observados | P2 |
| Logs operativos | parcial | Medio | `public.subscription_events`, `public.webhook_events`, `supabase/functions/_shared/subscription-events.ts`, `supabase/functions/admin-overview/*` | hay eventos de checkout/cancelación; falta webhook real de pago aprobado | P1 |
| Errores visibles | parcial | Medio | auth, onboarding, billing, formularios y guards | falta repaso manual completo de copy/error UX en casos de proveedor y recovery | P2 |
| Correos / comunicaciones | parcial | Alto | Supabase Auth, `supabase/functions/_shared/email.ts`, `supabase/functions/manage-invitation/*`, `supabase/functions/cancel-subscription/*`, `supabase/functions/mp-webhook/*` | invitación y lifecycle billing no enviarán hasta configurar SMTP real; reset password depende de Auth email externo y quedó solo parcialmente validado | P1 |
| Métricas mínimas | ausente | Medio | `src/lib/analytics.ts` y pantallas críticas | no hay evidencia de eventos operativos mínimos de registro/onboarding/upgrade/cancelación corriendo en un backend analizable | P2 |
| Tests automatizados / smoke | parcial | Medio | `tests/plans.test.ts`, smoke temporal local `tmp/release-smoke-v2.mjs` | existe smoke real local no versionado; falta formalizar smoke repetible en CI o checklist operativa estable | P1 |

## Orden recomendado de corrección restante

1. Cerrar billing real: pago aprobado end-to-end, webhook real procesado y cancelación sobre suscripción ya cobrada.
2. Configurar SMTP real para invitaciones y lifecycle emails; hoy quedó endurecido para marcar `smtp_not_configured` en vez de fallar con placeholders.
3. Validar confirmación de email y recovery con inbox real y sin bypass admin.
4. Aclarar y documentar el modelo actual del plan Free materializado como `subscriptions.status = inactive` o remover esa dependencia si no es intencional.
5. Completar validación funcional de resumen mensual/recurrencias con UI real y, si aplica, instrumentar métricas mínimas operativas.

## Cambios aplicados durante la auditoría

- `supabase/functions/_shared/subscription.ts`
  - se agregó `auto_recurring.end_date` para el payload de Mercado Pago en checkout pending.
- `supabase/functions/create-subscription/index.ts`
  - redeploy con el helper corregido.
- `supabase/functions/update-subscription/index.ts`
  - redeploy con el helper corregido.
- `supabase/functions/_shared/email.ts`
  - se agregó detección de placeholders SMTP para devolver `smtp_not_configured` y no intentar DNS contra hosts ficticios.
- `supabase/functions/manage-invitation/index.ts`
  - redeploy usando el helper endurecido.
- `supabase/functions/cancel-subscription/index.ts`
  - redeploy usando el helper endurecido.
- `supabase/functions/mp-webhook/index.ts`
  - redeploy usando el helper endurecido.
- `src/features/admin/AdminPage.tsx`
  - vista admin mínima operativa ya integrada en fase previa.
- `supabase/functions/admin-overview/index.ts`
  - función operativa ya desplegada en fase previa.

## Bloqueantes P0 actuales

- No hay evidencia real de **pago aprobado end-to-end** en Mercado Pago.
- No hay evidencia real de **webhook aprobado** procesando cambio a `active`.
- No hay evidencia real de **cancelación sobre suscripción ya cobrada**, solo sobre preapproval pendiente.

## REAUDITORÍA DE FASE 1 — Auth y sesión

| Flujo | Estado real | Evidencia | Riesgo residual | ¿Bloquea continuar? |
| --- | --- | --- | --- | --- |
| Registro | PASS | signup público completado y login exitoso | falta click real desde correo de verificación | no |
| Login / logout / persistencia | PASS | login inválido rechazado, login válido, persistencia y logout probados | sin riesgo bloqueante observado | no |
| Recuperar / restablecer | PARTIAL | recovery completado con `admin.generateLink` y actualización de contraseña en producción | `resetPasswordForEmail` quedó rate-limited durante la corrida y no hubo inbox real | no |

## REAUDITORÍA DE FASE 2 — Onboarding, hogar e invitaciones

| Flujo | Estado real | Evidencia | Riesgo residual | ¿Bloquea continuar? |
| --- | --- | --- | --- | --- |
| Crear hogar | PASS | hogar y owner membership creados | sin riesgo bloqueante observado | no |
| Crear invitación | PASS | invitación creada + previews valid/invalid/expired | correo automático no sale por SMTP ausente | no |
| Aceptar invitación | PASS | wrong account rechazado, miembro unido correctamente | sin riesgo bloqueante observado | no |

## REAUDITORÍA DE FASE 3 — Núcleo funcional

| Flujo | Estado real | Evidencia | Riesgo residual | ¿Bloquea continuar? |
| --- | --- | --- | --- | --- |
| Movimientos create/edit/delete | PASS | create, update y delete validados en producción | sin riesgo bloqueante observado | no |
| Consistencia de datos | PASS | reflejo en BD con 1 activo y 1 eliminado | falta validación UI de resumen mensual/comparación | no |
| Metas / límite Free | PASS | primera meta creada, segunda bloqueada | falta edición/cierre end-to-end | no |

## REAUDITORÍA DE FASE 4 — Suscripción y billing

| Flujo | Estado real | Evidencia | Riesgo residual | ¿Bloquea continuar? |
| --- | --- | --- | --- | --- |
| Ver plan actual | PARTIAL | hogares nuevos quedan con fila `inactive`; la app igual resuelve Free | origen de la fila no trazado en repo | no |
| Iniciar checkout | PASS | `create-subscription` devolvió `init_point`, `preapproval_id` y fila local `pending` | Mercado Pago rechaza emails desechables; el smoke tuvo que usar `example.net` para billing | no |
| Sync de estado | PARTIAL | `sync-subscription-status` devolvió `pending / pending` | falta approved/failed reales | no |
| Acceso premium | PASS | hogar beta `plus/active` pudo crear recurrencia y categoría custom | depende de beta activa sembrada, no de pago de esta corrida | no |
| Cancelación | PARTIAL | cancelación autónoma validada sobre preapproval `pending` | falta cancelación sobre suscripción cobrada | sí |
| Webhook real | PARTIAL | existen `subscription_events` de checkout/cancelación | no hubo webhook de cobro aprobado procesado | sí |

## REAUDITORÍA DE FASE 5 — Operación mínima, logs y comunicaciones

| Flujo | Estado real | Evidencia | Riesgo residual | ¿Bloquea continuar? |
| --- | --- | --- | --- | --- |
| Admin mínimo | PASS | `admin-overview` responde summary, hogares y eventos | sin riesgo bloqueante observado | no |
| Logs de suscripción | PARTIAL | `subscription_events` capturó `checkout_started` y `subscription_cancelled` | falta `webhook_active`/`payment_issue` real | no |
| Correos transaccionales | PARTIAL | ahora devuelven `smtp_not_configured` en vez de fallar por placeholder | falta SMTP real y prueba de envío | no |

## Lectura operativa actual

- El producto ya soporta **registro, acceso, hogar, invitación por link, CRUD núcleo, premium activo y admin mínimo**.
- Billing quedó **materialmente mejor**: checkout ya inicia de forma consistente con Mercado Pago y el gating premium se probó en un hogar activo real.
- Aun así, **no hay evidencia suficiente para llamar “cerrado” al lifecycle pagado completo**.
- La app **sí está en condiciones de seguir en beta cerrada**, pero no de vender sin monitoreo/manual support en billing y comunicaciones.
