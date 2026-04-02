# Master Control System v1 Roles

## Principio

Compás Hogar v1 no usa una sola cuenta omnipotente como modelo normal de operación.

La capa interna de control se apoya en:
- `public.control_role_assignments`
- compatibilidad temporal con `profiles.is_admin`

La compatibilidad heredada existe solo para no cortar operación mientras se migra a RBAC explícito.

## Roles v1

### CEO
- lectura amplia:
  - Cockpit Ejecutivo
  - Billing Room
  - Customer 360
  - Operations Room
  - Risk & Audit
  - Growth Room
- no incluye acciones destructivas por defecto
- objetivo:
  - entender negocio, salud operativa y riesgos sin convertirse en operador diario

### OPS_ADMIN
- lectura amplia
- foco operativo
- puede diagnosticar:
  - billing
  - households
  - invitaciones
  - inconsistencias
  - riesgos operativos
- v1 no agrega mutaciones complejas nuevas desde UI, pero este rol queda preparado para acciones operativas controladas

### FINANCE_ADMIN
- foco en:
  - Billing Room
  - Customer 360
  - Risk & Audit
  - lectura ejecutiva
- pensado para revisar:
  - estado de suscripciones
  - provider ids
  - cobros
  - fallos comerciales

### SUPPORT
- foco en:
  - Customer 360
  - Operations Room
  - Risk & Audit
- objetivo:
  - resolver casos de usuario sin entrar a ciegas a la base

### BREAK_GLASS
- acceso excepcional
- cubre todos los módulos
- reservado para contingencia y operación crítica
- no debe ser el modo normal de trabajo

## Matriz de acceso v1

| Rol | Ejecutivo | Billing | Customer 360 | Operaciones | Riesgos | Crecimiento | Escritura sensible |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CEO | Sí | Sí | Sí | Sí | Sí | Sí | No por defecto |
| OPS_ADMIN | Sí | Sí | Sí | Sí | Sí | Sí | Controlada / futura |
| FINANCE_ADMIN | Sí | Sí | Sí | No principal | Sí | Sí | Controlada / futura |
| SUPPORT | No principal | No principal | Sí | Sí | Sí | No | Limitada / futura |
| BREAK_GLASS | Sí | Sí | Sí | Sí | Sí | Sí | Sí, excepcional |

## Implementación actual

La autorización de v1 usa:
- tabla `control_role_assignments`
- helper compartido `shared/control.ts`
- guard frontend:
  - `ControlGuard`
  - `ControlModuleGuard`
- validación backend:
  - `supabase/functions/_shared/control-auth.ts`

## Compatibilidad heredada

Mientras existan cuentas con `profiles.is_admin = true`, el sistema:
- les asigna acceso efectivo `BREAK_GLASS`
- permite seguir operando sin corte
- deja trazabilidad inicial en `audit_logs` al bootstrap de roles

Esto es un puente de compatibilidad, no el estado objetivo final.

## Reglas de seguridad

- Toda mutación sensible nueva del Master Control System debe quedar auditada.
- El rol `CEO` no debe recibir acciones destructivas por defecto.
- `BREAK_GLASS` debe mantenerse acotado y explícito.
- El sistema de control no debe reinterpretar billing ni entitlements por su cuenta.

## Qué no incluye v1 todavía

- consola visual completa para asignar o revocar roles desde UI
- flujos complejos de aprobación de permisos
- expiración automática de roles
- delegación temporal avanzada

Eso queda como backlog posterior para no inflar riesgo en esta fase.
