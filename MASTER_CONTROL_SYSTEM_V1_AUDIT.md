# Master Control System v1 Audit

## Estado actual reutilizable

### Admin y operación
- Ya existe un panel mínimo en `/admin/*` respaldado por `admin-overview`.
- `admin-overview` ya entrega:
  - conteos de usuarios, hogares y suscripciones,
  - hogares recientes con owner, plan y estado,
  - `webhook_events` recientes,
  - `subscription_events` recientes.
- `profiles.is_admin` ya funciona como control de acceso operativo mínimo.

### Datos de negocio reutilizables
- Las tablas actuales ya permiten construir una v1 útil sin rehacer billing:
  - `profiles`
  - `households`
  - `household_members`
  - `subscriptions`
  - `subscription_events`
  - `webhook_events`
  - `invitation_tokens`
  - `transactions`
  - `savings_goals`
  - `payment_calendar_items`
  - `recurring_transactions`
  - `audit_logs`
  - `billing_provider_configs`
- `resolve_current_household_context` y `household resolution v1` ya están cerrados y no deben reabrirse.
- La simplificación comercial visible `Free + Premium` ya está cerrada en frontend y convive con billing interno `base / plus / admin`.

### Frontend reutilizable
- Ya existe estructura de guards, hooks y layout reutilizable:
  - `useAuth`
  - `useHousehold`
  - `useSubscription`
  - `AuthGuard`
  - `AdminGuard`
  - componentes UI reutilizables (`Card`, `AlertBanner`, `EmptyState`, `LoadingPage`, `PlanBadge`, `Button`)
- El lenguaje visible del producto ya está mayormente en español.

### Billing y lifecycle
- El backend ya escribe trazas parciales útiles en:
  - `subscription_events`
  - `webhook_events`
- Las funciones de billing existentes ya son una buena base de lectura operativa:
  - `create-subscription`
  - `update-subscription`
  - `cancel-subscription`
  - `sync-subscription-status`
  - `mp-webhook`

### Señales de growth ya disponibles
- Existe instrumentación client-side en `src/lib/analytics.ts` con eventos como:
  - `signup_completed`
  - `onboarding_completed`
  - `first_transaction_created`
  - `first_goal_created`
  - `checkout_started`
  - `upgrade_completed`
- Esa instrumentación hoy no persiste en base de datos, por lo que solo sirve como semántica y no como fuente ejecutiva confiable.

## Vacíos críticos

### RBAC
- Hoy no existe una estructura real de roles internos.
- El sistema depende de `profiles.is_admin`, que es demasiado binario para CEO / Ops / Finance / Support / Break Glass.

### Auditoría operativa
- `audit_logs` existe, pero hoy no es una pieza viva del producto.
- No hay feed de auditoría utilizable ni estándar para acciones del panel interno.

### Analytics ejecutiva
- No existe una capa persistida de eventos de crecimiento.
- No existen snapshots ni vistas agregadas de KPIs.
- Varias métricas del bloque Growth solo pueden inferirse parcialmente desde tablas de dominio.

### Customer 360 y soporte
- No existe una vista consolidada de usuario/hogar.
- Soporte todavía depende demasiado de combinar piezas manualmente o entrar a BD.

### Operations Room
- No existe una cola visible de incidentes o anomalías.
- La información está dispersa entre `subscriptions`, `webhook_events`, `invitation_tokens` y problemas de memberships.

## Riesgos

### Billing
- Cualquier cambio que toque mappings de `plan_code`, `status`, provider ids o lectura de suscripciones puede romper cobro, visibilidad comercial o entitlements.
- El panel de control debe leer billing sin mutar ni reinterpretar estados de forma creativa.

### Entitlements
- La app sigue usando tiers internos `free / essential / strategic`.
- La capa visible ya fue simplificada a `Free / Premium`, por lo que el control interno no debe mezclar semánticas visibles e internas.

### Household / auth
- Ya existe un fix estructural de household resolution. No se debe reabrir ni duplicar lógica.
- Los flujos críticos de auth, invitación y recovery ya fueron cerrados aparte; el panel no debe interferir con ellos.

### Datos insuficientes
- Algunas métricas ejecutivas no pueden calcularse de forma robusta con la data histórica actual.
- En esos casos v1 debe mostrar `No disponible aún` o una definición explícita y honesta, nunca números inventados.

## Dependencias

### Técnicas
- Supabase Auth para identidad.
- Edge Functions para lectura segura con service role.
- Tablas actuales de billing, households, invitaciones y actividad.

### Operativas
- Al menos un usuario con acceso interno.
- Compatibilidad con `profiles.is_admin` mientras se introduce RBAC.

## Qué entra en v1

### Sí entra
- Capa RBAC mínima y explícita para control interno.
- Layout y rutas dedicadas para `/app/control/*`.
- Cockpit Ejecutivo.
- Billing Room.
- Customer 360.
- Operations Room.
- Risk & Audit.
- Growth Room con métricas honestas basadas en evidencia disponible.
- Reutilización de `audit_logs`, `subscription_events` y `webhook_events` como base operativa.
- Compatibilidad temporal con `profiles.is_admin`.

### Criterio de implementación
- Backend único de lectura por módulo, con control de acceso por rol.
- V1 prioriza lectura ejecutiva y operación segura por sobre escritura interna.
- Las acciones sensibles nuevas deben ser pocas y auditables.

## Qué queda fuera de v1 y por qué

- Backoffice financiero completo con mutaciones complejas:
  - demasiado riesgoso para billing en esta fase.
- Pronósticos avanzados, scoring o anomalías inteligentes:
  - requieren una capa analítica más madura.
- CRM, BI o integraciones externas:
  - no son indispensables para un cierre robusto de v1.
- Gestión completa de roles desde UI:
  - la base RBAC sí entra, pero la consola de administración de permisos puede quedar posterior si complica demasiado el cierre seguro.
- Analytics avanzada multi-cohorte:
  - hoy no existe fuente persistida suficiente para sostenerla sin sobrediseño.

## Tabla inicial de auditoría

| Área | Estado actual | Reutilizable sí/no | Riesgo | Acción propuesta | ¿Afecta billing? | ¿Afecta entitlements? |
| --- | --- | --- | --- | --- | --- | --- |
| Panel admin actual | Existe `admin-overview` + `AdminPage` mínimo | Sí | Bajo | Extender compatiblemente y no reemplazar a ciegas | No | No |
| RBAC | Solo `profiles.is_admin` | Parcial | Medio | Crear capa mínima de roles y compatibilidad heredada | No | No |
| Billing data | `subscriptions`, `subscription_events`, `webhook_events` útiles | Sí | Alto | Reutilizar como fuente oficial de Billing Room | Sí | Sí |
| Auditoría | `audit_logs` existe, pero no se usa en producto | Sí | Medio | Convertirlo en feed real de Risk & Audit | No | No |
| Growth analytics | Eventos browser existen, pero no persisten | Parcial | Medio | Usar equivalentes de dominio y marcar huecos como no disponibles | No | No |
| Customer 360 | No existe vista consolidada | No | Medio | Construir lectura consolidada desde backend | No | No |
| Operations Room | No existe cola de casos | No | Medio | Derivar incidentes desde anomalías actuales | No | No |
| Roles y permisos visibles | No existen | No | Medio | Documentar y aplicar matriz mínima v1 | No | No |
| Household resolution | Cerrado y estable | Sí, pero no tocar | Alto | Consumirlo como dependencia, no reabrirlo | No | No |
| Simplificación Free + Premium visible | Cerrada | Sí | Alto | Mantenerla intacta en control interno | Sí | Sí |
