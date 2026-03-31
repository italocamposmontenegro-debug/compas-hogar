# Audit de cierre funcional

Fecha de inicio de auditoría: 2026-03-30

## Estado inicial real

| Bloque | Estado real | Riesgo | Archivos involucrados | Qué falta | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Registro | parcial | Medio | `src/features/auth/index.tsx`, `src/hooks/useAuth.tsx`, `supabase/migrations/20260320161700_auth_trigger.sql` | validar flujo real con confirmación y errores | P0 |
| Login | parcial | Medio | `src/features/auth/index.tsx`, `src/hooks/useAuth.tsx`, `src/components/shared/Guards.tsx` | smoke real y manejo de errores de borde | P0 |
| Logout | parcial | Bajo | `src/hooks/useAuth.tsx`, `src/components/layout/AppLayout.tsx` | smoke real y retorno correcto a rutas públicas | P1 |
| Persistencia de sesión | parcial | Medio | `src/hooks/useAuth.tsx`, `src/lib/supabase.ts` | validar recuperación tras refresh y foco | P0 |
| Verificación de email | parcial | Medio | `src/features/auth/index.tsx`, `src/features/auth/VerifyEmailPage.tsx`, Supabase Auth | confirmar redirección y acceso posterior | P1 |
| Recuperar/restablecer contraseña | parcial | Alto | `src/features/auth/index.tsx`, `src/hooks/useAuth.tsx` | validar end-to-end sin soporte manual | P0 |
| Crear hogar | parcial | Medio | `src/features/onboarding/OnboardingPage.tsx`, `supabase/migrations/20260322190000_runtime_fixes.sql` | smoke real y mensajes de error | P0 |
| Unirse a hogar | parcial | Medio | `src/features/onboarding/InvitationPage.tsx`, `supabase/functions/accept-invitation/*`, `supabase/functions/preview-invitation/*` | validar flujo con cuenta nueva y cuenta existente | P0 |
| Invitaciones | parcial | Medio | `src/features/settings/SettingsPage.tsx`, `supabase/functions/manage-invitation/*`, `supabase/functions/_shared/email.ts` | confirmar email, enlace y estados inválidos | P0 |
| Dashboard inicial | parcial | Medio | `src/features/dashboard/DashboardPage.tsx` | validar lectura inicial y consistencia con datos reales | P1 |
| CRUD de transacciones | parcial | Alto | `src/features/transactions/TransactionsPage.tsx`, `supabase/functions/manage-transaction/*` | smoke real create/edit/delete y reflejo cruzado | P0 |
| Categorías | parcial | Medio | `src/features/categories/CategoriesPage.tsx`, `supabase/functions/manage-category/*` | validar límites por plan y edición | P1 |
| Metas | parcial | Medio | `src/features/goals/GoalsPage.tsx`, `supabase/functions/manage-goal/*` | validar límites, primaria y reflejo en dashboard | P1 |
| Resumen mensual | parcial | Medio | `src/features/monthly-review/MonthlySummaryPage.tsx`, `supabase/functions/save-monthly-review/*` | validar lectura y guardado | P1 |
| Recurrencias | parcial | Medio | `src/features/recurring/RecurringPage.tsx`, `supabase/functions/manage-recurring-transaction/*`, `supabase/functions/sync-recurring-items/*` | validar generación de pagos y toggles | P1 |
| Plan actual | parcial | Medio | `src/features/subscription/SubscriptionPage.tsx`, `src/hooks/useSubscription.ts` | smoke real de lectura post pago/cancelación | P0 |
| Gating por plan | parcial | Medio | `shared/plans.ts`, `src/hooks/useSubscription.ts`, guards y edge functions | validar restricciones reales y desbloqueo premium | P0 |
| Checkout | parcial | Alto | `supabase/functions/create-subscription/*`, `supabase/functions/update-subscription/*`, `supabase/functions/subscription-return/*` | retorno correcto y copy comercial | P0 |
| Webhook | parcial | Alto | `supabase/functions/mp-webhook/*`, `supabase/functions/_shared/subscription.ts` | validar procesamiento real y trazabilidad | P0 |
| Sync de suscripción | parcial | Medio | `supabase/functions/sync-subscription-status/*`, `src/features/subscription/SubscriptionPage.tsx` | validar corrección de estados pendientes | P1 |
| Cancelación | parcial | Alto | `supabase/functions/cancel-subscription/*`, `src/features/subscription/SubscriptionPage.tsx` | validar cancelación autónoma end-to-end | P0 |
| Admin mínimo | ausente | Alto | `src/features/admin/AdminPage.tsx` | construir vista útil de usuarios/hogares/suscripciones/eventos | P0 |
| Logs operativos | parcial | Alto | `supabase/functions/mp-webhook/*`, `public.webhook_events`, `public.subscription_events`, `public.audit_logs` | usar realmente `subscription_events` y exponer lectura admin | P1 |
| Errores visibles | parcial | Medio | auth, guards, formularios, billing pages | revisar mensajes ambiguos o heredados | P1 |
| Correos / comunicaciones | parcial | Alto | Supabase Auth, `supabase/functions/_shared/email.ts`, billing flows | branding correcto e hitos críticos de billing | P1 |
| Métricas mínimas | parcial | Medio | `src/lib/analytics.ts`, pantallas críticas | hoy solo dataLayer local; falta validación operativa | P2 |
| Tests automatizados / smoke | parcial | Alto | `tests/plans.test.ts` | falta smoke funcional real y cobertura de flujos críticos | P0 |

## Orden recomendado de corrección

1. Auth y sesión: acceso, persistencia, reset y rutas públicas/protegidas.
2. Onboarding, hogar e invitaciones: evitar limbo y asegurar primer valor.
3. Núcleo funcional: movimientos, reflejo entre vistas y consistencia matemática.
4. Billing: checkout, retorno, webhook, sync, gating y cancelación.
5. Operación mínima: admin útil, eventos de suscripción, mensajes críticos.
6. QA final: smoke documentado con criterio PASS / PARTIAL / FAIL.

## Bloqueantes P0 detectados al arranque

- recuperación/restablecimiento sin prueba real de punta a punta
- onboarding e invitaciones sin smoke real
- CRUD de transacciones sin smoke real cruzado con dashboard/calendario
- checkout y retorno con señales heredadas de entorno local
- webhook/cancelación sin trazabilidad suficiente para soporte
- admin mínimo ausente
- sin smoke suite funcional más allá de tests de planes
