# Commercial Positioning V2

## 1. Categoría
Sistema de orden financiero para parejas que construyen hogar.

## 2. ICP principal
Parejas convivientes, aproximadamente entre 25 y 40 años, con ingresos separados pero responsabilidades compartidas, que necesitan simpleza, orden y una lectura común del mes.

## 3. Promesa
Ver el mismo mes, saber cuánto puso cada uno, qué falta por cubrir y avanzar con menos fricción hacia proyectos comunes.

## 4. Qué NO somos
- No somos una app genérica de presupuesto.
- No somos una app de automatización bancaria como tesis central.
- No somos una app multiusuario genérica.
- No somos una app para grupos o roommates como foco principal.

## 5. Oferta
- Free = base compartida de arranque.
- Premium = orden financiero para crecer como hogar.
- Precio: CLP 4.990 mensual / CLP 49.900 anual.

## 6. Trial
No quedó implementado un trial real de 30 días.

Hallazgos concretos del repo:
- La tabla `subscriptions` tiene `trial_ends_at`, pero el flujo actual no lo usa como lifecycle real.
- `supabase/functions/create-subscription/index.ts` crea la suscripción con `trial_ends_at: null`.
- `supabase/functions/update-subscription/index.ts` reinicia la suscripción con `trial_ends_at: null`.
- `supabase/functions/mp-webhook/index.ts` solo preserva el valor existente; no inicia ni cierra un trial.

Falta exactamente para lanzar un trial real sin mentir:
- cobro diferido real sin cargo inmediato
- lifecycle de trial consistente en backend
- webhook consistente para inicio y término de trial
- expiración automática de trial
- downgrade seguro a Free
- correos de inicio y término de trial

## 7. Funnel recomendado
- visitante
- signup
- hogar creado
- primer mes cargado
- pareja invitada
- pareja aceptó
- Premium activado
- retención mes 2

## 8. Regla crítica
No escalar paid fuerte hasta que billing, cobro, webhook, correos y cancelación estén cerrados de punta a punta.
