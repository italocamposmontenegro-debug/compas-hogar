# RELEASE QA REPORT

Fecha de corrida final: 2026-03-31  
Entorno: producción (`https://compas-hogar.vercel.app`)  
Proyecto Supabase: `eukyxyahcxfnlexowepm`  
Seed de smoke: `release-1774925635345`

## Resultado por caso

| # | Caso | Resultado | Evidencia |
| --- | --- | --- | --- |
| 1 | Registro | PASS | Signup público completado para `release-1774925635345-owner@mailinator.com` y email confirmado vía admin. |
| 2 | Login | PASS | Login inválido rechazado; login válido, persistencia y logout funcionando. |
| 3 | Recuperar/restablecer contraseña | PARTIAL | El restablecimiento se completó con `admin.generateLink`, pero `resetPasswordForEmail` devolvió `email rate limit exceeded`. |
| 4 | Crear hogar | PASS | Hogar `f27db9f8-2fd7-4881-a742-063455e1828d` creado y owner membership confirmado. |
| 5 | Invitar miembro | PASS | Invitación creada; preview `valid/invalid/expired` confirmado; correo devuelto como `smtp_not_configured`. |
| 6 | Aceptar invitación | PASS | Cuenta incorrecta rechazada y miembro unido correctamente al hogar. |
| 7 | Crear movimiento | PASS | Movimiento creado correctamente. |
| 8 | Editar movimiento | PASS | Movimiento editado, eliminado y reemplazado por ingreso para validar consistencia. |
| 9 | Reflejo en dashboard / resumen de datos | PASS | BD refleja 1 movimiento activo, 1 eliminado y total ingresos visibles correcto. |
| 10 | Crear meta | PASS | Meta creada y segundo intento Free bloqueado correctamente. |
| 11 | Ver plan actual | PARTIAL | Un hogar nuevo ya aparece con fila de suscripción `inactive`; la app sigue resolviendo Free, pero el origen no quedó trazado. |
| 12 | Iniciar suscripción | PASS | Checkout Mercado Pago iniciado con preapproval `7be25237222c454591dc10ca974dd47e` y suscripción local `pending`. |
| 13 | Reflejo post pago | PARTIAL | Se validó sync `pending/pending`, pero no hubo cobro aprobado end-to-end. |
| 14 | Acceso premium correcto | PASS | Un hogar beta `plus/active` pudo crear recurrencia y categoría custom. |
| 15 | Cancelación | PARTIAL | Cancelación autónoma validada sobre preapproval pendiente; no sobre suscripción ya cobrada. |
| 16 | Restricción correcta post cancelación o impago | PASS | Recurrencias y categorías custom quedaron bloqueadas tras pasar a `cancelled`. |
| 17 | Acceso a admin mínimo | PASS | `admin-overview` entregó summary, hogares y eventos visibles. |
| 18 | Verificación de logs/eventos clave | PARTIAL | `subscription_events` capturó `checkout_started` y `subscription_cancelled`; no hubo webhook real de cobro aprobado. |

## Bloqueantes

### P0

1. **Billing aprobado no validado end-to-end**
   - No existe evidencia real de cobro aprobado en Mercado Pago que termine en suscripción `active`.

2. **Webhook real no validado**
   - No existe evidencia de un `authorized_payment` / `preapproval` aprobado entrando por `mp-webhook` y dejando trazabilidad completa.

3. **Cancelación de suscripción ya cobrada no validada**
   - Solo se probó cancelación sobre preapproval `pending`.

## Riesgos altos

1. **Comunicaciones transaccionales no configuradas**
   - Invitación y lifecycle billing devuelven `smtp_not_configured`.

2. **Recovery público no quedó verificado con inbox real**
   - Durante la corrida, `resetPasswordForEmail` pegó rate limit y hubo que completar el reset con `admin.generateLink`.

3. **Representación del plan Free con fila `subscriptions.status = inactive`**
   - No rompe gating actual, pero puede generar lectura ambigua y su origen no está trazado en las migraciones del repo.

## Riesgos medios

1. Resumen mensual y comparación no quedaron validados end-to-end en UI.
2. Categorías/metas/recurrencias no tienen smoke formal completo por toda la matriz de mutaciones.
3. Métricas mínimas de operación/comercialización no quedaron probadas contra backend analizable.

## Pruebas ejecutadas

- Smoke funcional real contra producción y Supabase:
  - auth
  - onboarding
  - invitaciones
  - CRUD de movimientos
  - metas Free
  - checkout pending
  - sync pending
  - premium activo
  - cancelación pending
  - gating post cancelación
  - admin overview
  - subscription events
- Validaciones técnicas locales:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

## Recomendación final

**GO solo beta cerrada**

### Motivo

- El núcleo del producto ya es utilizable por testers reales.
- Auth, onboarding, invitación por link, hogar, movimientos, metas, premium activo y admin mínimo están operativos.
- Billing mejoró materialmente: checkout ya inicia y la cancelación básica funciona.
- Pero todavía faltan tres cierres para salida comercial pagada:
  1. pago aprobado end-to-end
  2. webhook real aprobado
  3. cancelación sobre suscripción cobrada

### Condición para pasar a GO controlado con monitoreo

1. Ejecutar una compra real o de entorno controlado en Mercado Pago hasta `active`.
2. Confirmar webhook real procesado y trazado en `subscription_events` / `webhook_events`.
3. Confirmar cancelación posterior a cobro aprobado.
4. Configurar SMTP real y validar al menos:
   - invitación
   - confirmación de suscripción
   - aviso de problema de cobro
   - cancelación
