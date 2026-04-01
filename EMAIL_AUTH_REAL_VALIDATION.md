# Email Auth Real Validation

## Alcance

Se auditó y validó únicamente el bloque de acceso y comunicaciones reales:

- registro con correo real,
- verificación de correo si aplica,
- recovery/reset por correo real,
- invitación a hogar por correo real,
- funcionalidad real de mensajes y enlaces.

No se tocaron billing, monthly review, métricas, household resolution ni la cuenta activa principal.

## Configuración real observada

### Supabase Auth
- **Registro** y **recovery** usan `supabase.auth.signUp` y `supabase.auth.resetPasswordForEmail`.
- El frontend apunta a:
  - verificación: `${window.location.origin}/verificar-email`
  - reset: `${window.location.origin}/restablecer-clave`
- En la configuración actual del proyecto, el signup **auto-confirma** el correo:
  - el usuario nuevo recibió sesión inmediata,
  - `auth.users.email_confirmed_at` quedó poblado en el mismo momento del alta,
  - por lo tanto **no se emite email de verificación en el estado actual del proyecto**.

### Invitaciones
- Las invitaciones por correo salen por `supabase/functions/manage-invitation`.
- Esa función usa `supabase/functions/_shared/email.ts`.
- El helper SMTP devuelve `smtp_not_configured` cuando faltan secretos reales o detecta placeholders.

### SMTP real observado
- En `supabase secrets list` existen secretos `SMTP_*` cargados en el proyecto.
- Sin embargo, la invocación real de `manage-invitation` devolvió:
  - `attempted: false`
  - `sent: false`
  - `reason: smtp_not_configured`
- Con eso, el sistema hoy **no está entregando invitaciones por correo real**.

## Cuentas limpias usadas

- Owner de prueba:
  - `owneremail1775004025483@mailinator.com`
  - `user_id = a70d5f72-3295-4d0f-9edf-3dc64963c12c`
- Invitado de prueba:
  - `memberemail1775004025483@mailinator.com`
  - `user_id = 5cd9c9da-d0e9-4a87-a515-9b74601fc981`

Hogar de prueba creado:
- `4566ffd4-f0d4-43b6-9bfb-07c10fb3b4fb`
- nombre: `Hogar Email email-1775004025483`

## Evidencia real ejecutada

### 1. Registro real
- Se hizo signup con `owneremail1775004025483@mailinator.com`.
- `signUp` devolvió sesión inmediata.
- Luego se cerró sesión y se hizo login normal con la contraseña creada.
- Verificación SQL directa:
  - `auth.users.email_confirmed_at = 2026-04-01 00:40:25.192772+00`
  - `auth.users.confirmed_at = 2026-04-01 00:40:25.192772+00`

Conclusión:
- **el registro real funciona**
- **la verificación por correo no aplica hoy**, porque Auth está auto-confirmando

### 2. Recovery / reset real
- Se disparó `resetPasswordForEmail` sobre una cuenta limpia de prueba.
- Se reintentó 9 veces con backoff durante más de 4 minutos.
- Resultado sostenido:
  - `email rate limit exceeded`
- No llegó correo de reset al inbox real usado para la prueba.

Conclusión:
- **no quedó validado de punta a punta**
- hoy el recovery público **no puede considerarse cerrado**

### 3. Invitación por correo real
- Owner de prueba creó invitación desde `manage-invitation`.
- La función devolvió:

```json
{
  "email_delivery": {
    "attempted": false,
    "sent": false,
    "reason": "smtp_not_configured"
  }
}
```

- No llegó correo al inbox real del invitado.

Conclusión:
- **la invitación por correo real falla hoy por configuración SMTP**

### 4. Funcionalidad del enlace de invitación
Se probó aparte el enlace generado, para separar claramente delivery vs lógica del link:

- `preview-invitation` devolvió `pending`
- `accept-invitation` devolvió `success: true`
- la membership del invitado quedó en el hogar correcto:
  - `household_id = 4566ffd4-f0d4-43b6-9bfb-07c10fb3b4fb`
  - `role = member`
  - `invitation_status = accepted`

Conclusión:
- **el enlace generado sí es funcional**
- **lo que falla es la entrega por correo**

## Tabla final

| Caso | Estado | Evidencia | Riesgo residual | ¿Bloquea salida comercial? |
| --- | --- | --- | --- | --- |
| Registro con correo real | PASS | signup real con inbox externo, sesión inmediata, login posterior exitoso | bajo | no |
| Verificación de correo real | PASS | no aplica en la configuración actual: `email_confirmed_at` quedó poblado al momento del signup | si el negocio quiere prueba de propiedad del correo, hoy no existe ese paso | no |
| Recovery/reset por correo real | FAIL | 9 intentos reales, mismo resultado: `email rate limit exceeded`; no llegó correo | el usuario no puede recuperar la cuenta con evidencia real cerrada | sí |
| Invitación a hogar por correo real | FAIL | `manage-invitation` devolvió `smtp_not_configured`; no llegó correo al inbox real | el flujo de colaboración por email no funciona sin intervención manual | sí |
| Enlace de invitación funcional | PASS | `preview-invitation = pending`, `accept-invitation = success`, membership creada correctamente | delivery sigue roto | no |
| Mensajes y enlaces de punta a punta | PARTIAL | signup funciona, link de invitación funciona, pero recovery y envío SMTP no quedaron cerrados | acceso/comunicaciones todavía dependen de configuración externa ausente o restrictiva | sí |

## Secretos / configuraciones externas necesarias

### Para invitación por correo real
Se requiere que el proyecto tenga **valores reales y no-placeholder** para:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

Además:
- el helper actual ya está desplegado y responde `smtp_not_configured` si los valores no son utilizables
- no hace falta cambiar lógica para validar esto; hace falta corregir la configuración externa

### Para recovery/reset real
Se requiere revisar la configuración externa de Supabase Auth:

- provider de email/Auth en producción
- límites reales de envío para recovery
- si existe rate limiting demasiado agresivo o una cuota ya agotada
- redirect URL válida para `/restablecer-clave`

### Para registro/verificación
Hoy el proyecto está efectivamente en modo auto-confirmación.

Si el negocio quiere verificación real por correo antes de entrar:
- hay que habilitar confirmación por email en Supabase Auth
- y volver a validar con inbox real

## Archivos modificados

- [EMAIL_AUTH_REAL_VALIDATION.md](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/EMAIL_AUTH_REAL_VALIDATION.md)

No fue necesario cambiar lógica del producto en esta iteración.

## Riesgos residuales

1. **Recovery/reset no está cerrado**
   - la evidencia real terminó en rate limit sostenido
   - no hay prueba e2e satisfactoria con correo real

2. **Invitación por correo no está operativa**
   - el sistema genera links válidos
   - pero no entrega el correo porque SMTP no está utilizable

3. **Verificación de correo no existe como paso real hoy**
   - esto no rompe acceso
   - pero sí significa que no hay validación de propiedad del email en el onboarding actual

## Veredicto del bloque

**FAIL**

Razón:
- el acceso inicial básico funciona,
- pero **no** quedó demostrado que un usuario pueda:
  - recuperar su contraseña por correo real,
  - recibir una invitación por correo real,
  - operar sin soporte/manualidad en esos dos flujos críticos.

## Siguiente acción mínima correcta

1. corregir la configuración SMTP real del proyecto hasta que `manage-invitation` deje de responder `smtp_not_configured`
2. revisar y normalizar la configuración/rate limit de recovery en Supabase Auth
3. rerun corto con inbox real para confirmar:
   - recovery email recibido,
   - reset completado,
   - invitación email recibida,
   - aceptación desde link entregado por correo
