# Commercial Simplification Free + Premium

Fecha: 2026-04-02

## Alcance

Este cambio simplifica la capa comercial visible a solo dos planes:

1. `Free`
2. `Premium`

Sin tocar:

- billing interno,
- entitlements reales,
- webhooks,
- provider ids,
- monthly review,
- recovery,
- SMTP,
- household resolution.

## Tabla de auditoría previa

| Punto auditado | Riesgo | Acción propuesta | ¿Afecta billing? | ¿Afecta entitlements? |
| --- | --- | --- | --- | --- |
| [shared/plans.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/shared/plans.ts) concentra nombres públicos, pricing y upgrade copy | Alto: si se cambia agresivamente, puede romper mapping interno `base/plus/admin` | Crear una capa comercial visible separada `Free + Premium` y mantener intactos los tiers internos `free/essential/strategic` | no | no |
| [SubscriptionPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/subscription/SubscriptionPage.tsx) renderiza 3 planes visibles y copy Esencial/Estratégico | Alto: expone la arquitectura interna al usuario final | Renderizar solo 2 cards visibles y encapsular Premium -> `plus` en checkout visible | no | no |
| [LandingPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/landing/LandingPage.tsx) renderiza pricing comercial con 3 tiers | Medio: sigue vendiendo Base/Essential | Mostrar solo `Free + Premium` con mensual por defecto | no | no |
| `getFeatureUpgradeCopy` en [shared/plans.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/shared/plans.ts) sigue sugiriendo `essential/strategic` y rutas `plan=essential/strategic` | Alto: el plan fantasma sigue escapando por CTAs y paywalls | Mantener `requiredPlan` interno, pero cambiar badge/copy/route visibles a `Premium` / `plan=premium` | no | no |
| Upgrade prompts dispersos en pantallas ya usan `getFeatureUpgradeCopy`, pero existen algunos textos fijos | Medio | Cambiar solo los textos visibles fijos que aún nombran `Esencial/Estratégico` | no | no |
| Tests de planes actuales validan tiers internos y rutas visibles viejas | Alto si no se ajustan: la simplificación visible queda sin garantía | Añadir assertions para `COMMERCIAL_PLAN_INFO`, `plan=premium` y preservación de mappings internos | no | no |
| Admin interno sigue mostrando `Esencial/Estratégico` | Bajo para la meta comercial; es visibilidad operativa interna, no oferta pública | Mantenerlo intacto por compatibilidad operativa en esta iteración | no | no |

## Implementación aplicada

### 1. Capa comercial visible encapsulada

Se agregó una capa nueva en [shared/plans.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/shared/plans.ts):

- `CommercialPlanTier = 'free' | 'premium'`
- `COMMERCIAL_PLAN_INFO`
- `COMMERCIAL_PLAN_ORDER`
- `mapTierToCommercialPlan()`
- `getCommercialPlanInfo()`

Regla aplicada:

- `free` visible -> `free` interno
- `premium` visible -> `plus / strategic` como ruta comercial visible

La compatibilidad interna se mantiene:

- `PlanTier` sigue siendo `free | essential | strategic`
- `BillingPlanCode` sigue siendo `base | plus | admin`
- `mapBillingPlanCodeToTier()` no cambió
- `resolvePlanTier()` no cambió
- `PLAN_FEATURES` y `PLAN_LIMITS` no cambiaron

### 2. Pricing visible

Se ajustó [LandingPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/landing/LandingPage.tsx):

- ahora muestra solo `Free` y `Premium`
- mensual queda por defecto
- anual sigue disponible
- desaparecen los CTAs visibles `Elegir Esencial` / `Elegir Estratégico`

### 3. Página de suscripción

Se ajustó [SubscriptionPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/subscription/SubscriptionPage.tsx):

- solo renderiza 2 cards visibles
- `Premium` apunta comercialmente a `billingPlanCode = plus`
- el usuario no ve `Base`, `Esencial` ni `Estratégico`
- la query visible de upgrade pasa a `plan=premium`
- mensual queda por defecto para visitas nuevas
- anual sigue visible

Compatibilidad preservada:

- si el hogar ya tiene suscripción pagada, la pantalla sigue usando `update-subscription`
- si no tiene suscripción pagada, sigue usando `create-subscription`
- no se tocaron provider ids ni lógica de sincronización/cancelación

### 4. Upgrade prompts y copy visible

Se cambió la capa visible de upgrade en [shared/plans.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/shared/plans.ts):

- `badge`: `Disponible en Premium`
- `message`: `Actualiza a Premium para usar esta función.`
- `actionLabel`: `Desbloquear Premium`
- `route`: `/app/suscripcion?plan=premium&feature=...`

Además se ajustaron textos visibles fijos en:

- [TransactionsPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/transactions/TransactionsPage.tsx)
- [GuidedClosePage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/guided-close/GuidedClosePage.tsx)

## Archivos modificados

- [shared/plans.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/shared/plans.ts)
- [src/lib/constants.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/lib/constants.ts)
- [src/features/landing/LandingPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/landing/LandingPage.tsx)
- [src/features/subscription/SubscriptionPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/subscription/SubscriptionPage.tsx)
- [src/features/transactions/TransactionsPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/transactions/TransactionsPage.tsx)
- [src/features/guided-close/GuidedClosePage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/guided-close/GuidedClosePage.tsx)
- [tests/plans.test.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/tests/plans.test.ts)

## Tabla final de validación

| Caso | Estado | Evidencia | ¿Afecta billing? | ¿Afecta entitlements? | Riesgo residual |
| --- | --- | --- | --- | --- | --- |
| Pricing visible = solo Free + Premium | PASS | [LandingPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/landing/LandingPage.tsx) y [SubscriptionPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/subscription/SubscriptionPage.tsx) renderizan `COMMERCIAL_PLAN_ORDER = ['free', 'premium']` | no | no | bajo |
| Base/Essential no visible en frontend público | PASS | barrido final en `src/features/landing`, `src/features/subscription`, `src/features/transactions`, `src/features/guided-close`: sin coincidencias visibles | no | no | bajo |
| CTA de upgrade visible apunta a Premium | PASS | [shared/plans.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/shared/plans.ts) ahora devuelve `Disponible en Premium`, `Desbloquear Premium`, `plan=premium` | no | no | bajo |
| Checkout visible no emite nuevas compras comerciales hacia Base | PASS | la card pagada visible de [SubscriptionPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/subscription/SubscriptionPage.tsx) usa `billingPlanCode = 'plus'` | no | no | bajo |
| Suscripciones internas existentes siguen interpretándose correctamente | PASS | `mapBillingPlanCodeToTier('base') -> essential`, `plus/admin -> strategic`, tests OK | no | no | bajo |
| Entitlements reales no cambiaron accidentalmente | PASS | `PLAN_FEATURES`, `PLAN_LIMITS`, `resolvePlanTier`, `hasFeature` se mantuvieron; tests de capabilities OK | no | no | bajo |
| Tests relevantes siguen pasando | PASS | `npm run test` OK | no | no | bajo |
| Lint y typecheck siguen pasando | PASS | `npm run lint` OK, `npm run typecheck` OK | no | no | bajo |
| Build de producción sigue pasando | PASS | `npm run build` OK | no | no | bajo |

## Riesgos residuales

1. `PUBLIC_PLAN_INFO` mantiene internamente `Esencial` y `Estratégico` para compatibilidad con la capa de tiers actual.
   - Esto es deliberado.
   - La capa comercial visible nueva ya no usa esos nombres en la UI pública intervenida.

2. [AdminPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/admin/AdminPage.tsx) sigue mostrando `Esencial / Estratégico`.
   - Se considera aceptable en esta iteración porque es visibilidad operativa interna, no pricing público.

3. No se hizo una limpieza agresiva de `base` en backend ni en datos.
   - Se dejó soporte interno intacto por seguridad.

## Recomendación explícita

**PASS con deuda técnica controlada**

La simplificación comercial visible ya quedó implementada sin romper billing ni entitlements.  
La deuda que queda es deliberada y de compatibilidad interna, no un bug comercial visible.
