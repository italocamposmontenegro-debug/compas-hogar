# Commercial QA Checklist V2

## Superficies auditadas
- Landing comercial
- Onboarding
- Suscripción
- Configuración del hogar
- Transacciones
- Recurrencias
- Calendario de pagos
- Saldo Hogar
- Resumen / dashboard
- Páginas de invitación
- Superficies internas de soporte con texto visible (`admin`, `control`)

## Textos corregidos
- Se eliminó lenguaje visible con `miembro`, `miembros` e `integrante` en settings, pagos, transacciones, recurrencias, dashboard y Saldo Hogar.
- Se normalizó el lenguaje de reparto en `SPLIT_RULE_DESCRIPTIONS` para hablar de `personas` en vez de `miembros`.
- Se ajustaron mensajes de invitación para hablar de `tu pareja` cuando el contexto es claramente dual.
- Se limpiaron mensajes de soporte y confirmación para que mantengan el tono V2: hogar, pareja, mes, pagos, aportes y claridad.

## Eventos analíticos existentes
- `landing_cta_primary_click`
- `landing_cta_example_click`
- `signup_completed`
- `household_created`
- `first_income_created`
- `first_shared_expense_created`
- `partner_invite_sent`
- `partner_invite_accepted`
- `premium_viewed`
- `checkout_started`

## Eventos faltantes
- No faltan eventos críticos del funnel comercial mínimo solicitado.
- Cobertura actual:
  - `household_created` se dispara en el onboarding principal.
  - `first_income_created` se dispara desde la creación manual en `TransactionsPage`.
  - `first_shared_expense_created` se dispara desde la creación manual de gasto compartido en `TransactionsPage`.
  - `partner_invite_sent` se dispara en onboarding y en configuración al crear invitación.
  - `partner_invite_accepted` se dispara al aceptar la invitación desde la página pública.
  - `premium_viewed` se dispara al abrir la página de suscripción.

## Riesgos residuales antes de deploy
- Los eventos `first_income_created` y `first_shared_expense_created` cubren el flujo principal de UI actual, pero no otros posibles canales futuros como imports o automatizaciones externas.
- `premium_viewed` hoy representa exposición al plan pago en la página de suscripción; no mide exposición pasiva en todas las superficies comerciales.
- Persisten referencias a `miembro` solo en comentarios y utilidades internas no visibles al usuario final.

## Recomendación final
- `Listo para test con usuarios`
- Motivo:
  - el posicionamiento visible quedó consistente con V2 en las superficies auditadas
  - el funnel comercial mínimo ya puede medirse con eventos concretos
  - no se tocaron trial, billing ni entitlements sensibles
