# Master Control System v1 Backlog

## Criterio

Este backlog no representa deuda descuidada.
Representa decisiones deliberadas para mantener v1 sobria, segura y compatible con el sistema actual.

## Fuera de v1 por riesgo o alcance

### Gestión avanzada de roles
- UI completa para asignar/revocar roles
- expiración temporal de permisos
- aprobación en dos pasos para permisos sensibles
- histórico visual de cambios de permisos con diff detallado

Motivo:
- la base RBAC ya entra en v1;
- la consola completa de permisos puede abrir demasiado riesgo operativo si se acelera.

### Mutaciones complejas de billing desde el panel
- forzar estados de suscripción
- editar provider ids
- rehacer lifecycle comercial manualmente
- reemitir cobros o webhooks desde UI

Motivo:
- prioridad absoluta: no romper billing ni provider integrity.

### Analytics avanzada
- cohortes avanzadas
- forecasting de MRR
- churn predictivo
- scoring de activación
- atribución avanzada de conversión

Motivo:
- hoy no existe una capa persistida de analytics lo bastante madura para sostener eso sin sobrediseño.

### Detección inteligente de anomalías
- scoring automático de incidentes
- correlación inteligente entre fallos
- recomendaciones automáticas con IA

Motivo:
- v1 necesita primero una base operativa confiable y auditable.

### Integraciones externas de operación
- CRM
- BI externo
- helpdesk externo
- herramientas de revenue ops

Motivo:
- no son necesarias para validar la utilidad real de v1 dentro del producto actual.

### Mobile admin avanzado
- experiencia específica para operación móvil profunda
- tablas y flujos complejos adaptados a teléfono

Motivo:
- v1 debe ser usable en mobile, pero la operación intensiva seguirá siendo principalmente desktop.

## Métricas que quedan honestamente limitadas

### Growth
- `feature_blocked`
- `recovery_email_sent`
- `recovery_completed`

Motivo:
- hoy no existe persistencia robusta de esos eventos en backend.
- v1 los muestra como `No disponible aún` cuando corresponde.

### Comercial
- reconstrucción histórica completa del lifecycle de suscripciones antiguas si no hubo eventos persistidos en su momento

Motivo:
- existe trazabilidad parcial actual, pero no retroactiva perfecta.

## Evolución recomendada posterior

1. Persistir eventos de growth mínimos en backend.
2. Agregar consola segura de asignación de roles.
3. Incorporar acciones operativas auditadas de bajo riesgo.
4. Crear snapshots o vistas agregadas cuando el volumen ya lo justifique.
5. Recién después considerar forecasting y analítica avanzada.
