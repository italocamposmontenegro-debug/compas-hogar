# Email Config Blockers

## Resumen ejecutivo

El bloqueo actual de correos en Compás Hogar **no es de lógica principal del producto**.

Los dos problemas abiertos son de configuración operativa:

1. **Invitaciones por email**
   - hoy fallan en `supabase/functions/_shared/email.ts`
   - la función devuelve `smtp_not_configured`
   - el enlace se genera bien, pero el correo no se entrega

2. **Recovery/reset por email**
   - hoy usa `supabase.auth.resetPasswordForEmail(...)`
   - el endpoint devuelve `email rate limit exceeded`
   - el error aparece antes de que exista click de usuario o evaluación de redirect

Además:
- los redirects requeridos por frontend sí existen en código:
  - `/verificar-email`
  - `/restablecer-clave`
- pero deben estar permitidos también en la configuración de Supabase Auth

---

## Tabla final

| Bloque | Causa raíz | ¿Es código o configuración? | Acción exacta | Responsable | ¿Bloquea salida comercial? |
| --- | --- | --- | --- | --- | --- |
| Invitación por email | `getSmtpConfig()` devuelve `null`, por lo que `sendMail()` responde `smtp_not_configured` | Configuración | cargar y verificar secretos SMTP reales utilizables en Supabase Edge Functions | Operación / owner del proyecto | sí |
| Recovery/reset por email | `supabase.auth.resetPasswordForEmail` responde `email rate limit exceeded` en producción | Configuración / proveedor Auth | revisar canal de email de Supabase Auth y sus rate limits/cuotas | Operación / owner del proyecto | sí |
| Redirect de reset | el frontend usa `/restablecer-clave`, pero debe estar permitido en Auth | Configuración | asegurar que la URL exacta esté en Redirect URLs de Supabase Auth | Operación / owner del proyecto | sí |
| Redirect de verify | el frontend usa `/verificar-email`, pero hoy no aplica porque signup auto-confirma | Configuración | dejarla igualmente registrada si se quiere soportar confirmación por email más adelante | Operación / owner del proyecto | no |
| Verificación de correo | signup actual auto-confirma y no envía email de verificación | Configuración de Auth | decidir si v1 seguirá con auto-confirm o si se activará confirmación por email | Producto + Operación | no |

---

## Fase A — Auditoría exacta del SMTP de invitaciones

### Dónde devuelve `smtp_not_configured`
Archivo:
- [supabase/functions/_shared/email.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/supabase/functions/_shared/email.ts)

Ruta exacta:
- `getSmtpConfig()` lee secretos
- si faltan o parecen placeholders, devuelve `null`
- `sendMail()` detecta eso y responde:

```ts
{
  attempted: false,
  sent: false,
  reason: 'smtp_not_configured'
}
```

### Secretos exactos que exige
La capa SMTP propia exige estos secretos:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

### Reglas internas del helper
Aunque los secretos existan en Supabase, el helper igualmente los invalida si detecta placeholders o valores no reales.

Ejemplos que **rechaza explícitamente**:
- `smtp.example.com`
- `your-smtp-user`
- `your-smtp-password`
- valores que contengan `example.com`
- varios placeholders tipo `tu_host`, `tu_usuario`, etc.

### Dónde deben cargarse

#### Producción real
En **Supabase Edge Functions secrets** del proyecto:
- Proyecto Supabase
- Edge Functions
- Secrets

El helper de invitaciones lee esos valores con `Deno.env.get(...)`.

#### Desarrollo local
En entorno local equivalente, usando:
- `.env` local no versionado
- o `supabase secrets set` en proyecto vinculado local/preview

La referencia del repo está en:
- [.env.example](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/.env.example)

### ¿Hace falta proveedor externo adicional?
Sí, hace falta un **servidor SMTP real**.

No hace falta un proveedor específico del código.
Basta con cualquier SMTP estándar funcional, por ejemplo:
- Resend SMTP
- Postmark SMTP
- SendGrid SMTP
- Amazon SES SMTP
- Mailgun SMTP
- Gmail/Workspace SMTP no es recomendable para producción comercial

Conclusión de esta fase:
- el código ya soporta SMTP estándar
- el bloqueo actual está en la **configuración efectiva de esos secretos**, no en la lógica de envío

---

## Fase B — Auditoría exacta del recovery en Supabase Auth

### Flujo actual usado por la app
Archivo:
- [src/hooks/useAuth.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/hooks/useAuth.tsx)

La app usa hoy:

```ts
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/restablecer-clave`,
})
```

Entonces:
- el correo de recovery **no** lo envían nuestras edge functions
- lo envía **Supabase Auth**
- el redirect esperado apunta a:
  - `/restablecer-clave`

### Qué indica realmente el error `email rate limit exceeded`
Por la evidencia obtenida, este error:
- sale en el momento del request a `resetPasswordForEmail`
- aparece antes de cualquier click del usuario
- apareció sostenidamente tras 9 intentos con backoff

Eso permite afirmar:

#### Qué sí indica
- el bloqueo está en el **canal de email de Supabase Auth**
- no es un fallo de nuestro helper SMTP de invitaciones
- no es un fallo de la página `/restablecer-clave`
- no es un fallo del token de recovery

#### Qué puede estar causando ese rate limit
Las causas plausibles y consistentes con la evidencia son:
- rate limit normal de Supabase Auth para correos de recovery
- cuota agotada o ventana temporal saturada por pruebas recientes
- proveedor de email/Auth configurado pero limitado
- configuración de Auth/email operativa pero restringida

#### Qué no parece ser la causa principal
- redirect mal configurado
  - si el problema fuera el redirect, normalmente el correo podría generarse pero fallaría el link o sería rechazado por URL no permitida
  - aquí el endpoint ni siquiera permitió emitir el correo
- lógica frontend
  - el request sale correctamente y el error viene desde Supabase Auth

### Qué ajustes exactos revisar en Supabase Auth

En el dashboard de Supabase revisar:

#### 1. Authentication > Providers / Email
Revisar:
- si Email auth está habilitado
- si se usa proveedor por defecto de Supabase o SMTP custom para Auth
- si el canal de email está realmente configurado para recovery

#### 2. Authentication > Rate Limits
Revisar:
- límites de `reset password`
- límites por IP / email / ventana temporal
- si hubo throttling por pruebas recientes

#### 3. Authentication > URL Configuration
Revisar que estén permitidas exactamente estas URLs:
- `https://compas-hogar.vercel.app/restablecer-clave`
- `https://compas-hogar.vercel.app/verificar-email`

Si usas preview/staging, agregar también sus dominios exactos.

#### 4. Authentication > Email Templates
Revisar:
- template de recovery
- que no tenga una URL hardcodeada incorrecta
- que use correctamente el redirect dinámico esperado

### Estado actual verificable
- el signup hoy auto-confirma
- por eso no existe prueba real de verificación por email en la configuración actual
- eso no rompe recovery, pero confirma que la capa de Auth/email hoy no está operando en un modo “email confirmation first”

---

## Fase C — Checklist operativa ejecutable

### 1. SMTP de invitaciones

#### Paso
Verificar y corregir secretos SMTP reales

#### Dónde se hace
Supabase Project > Edge Functions > Secrets

#### Valor/secretos necesarios
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

#### Cómo verificarlo
1. confirmar que no sean placeholders
2. confirmar que `SMTP_PORT` sea número válido (`587` o `465`)
3. redeploy, si hace falta, de `manage-invitation`
4. crear una invitación de prueba
5. verificar que la respuesta ya no devuelva `smtp_not_configured`
6. verificar recepción real del email

---

### 2. Canal de email de Supabase Auth para recovery

#### Paso
Revisar proveedor de email/Auth y su estado real

#### Dónde se hace
Supabase Project > Authentication > Providers / Email

#### Valor/secretos necesarios
- configuración del proveedor de email de Auth
- si usa custom SMTP, sus credenciales válidas

#### Cómo verificarlo
1. confirmar que Email auth esté habilitado
2. confirmar que recovery email esté soportado
3. confirmar que el proveedor no esté deshabilitado o incompleto

---

### 3. Rate limit de recovery

#### Paso
Revisar y normalizar limits de reset password

#### Dónde se hace
Supabase Project > Authentication > Rate Limits

#### Valor/secretos necesarios
- configuración de límites de envío de recovery/reset

#### Cómo verificarlo
1. revisar límite actual
2. revisar si hubo throttling por pruebas recientes
3. esperar o limpiar la ventana si aplica
4. volver a disparar un único `forgot password`
5. confirmar que ya no responde `email rate limit exceeded`

---

### 4. Redirect URLs de Auth

#### Paso
Registrar redirects exactos del frontend

#### Dónde se hace
Supabase Project > Authentication > URL Configuration

#### Valor/secretos necesarios
- `https://compas-hogar.vercel.app/restablecer-clave`
- `https://compas-hogar.vercel.app/verificar-email`

Opcional si hay otros entornos:
- URLs de preview/staging exactas

#### Cómo verificarlo
1. comparar con lo que usa el frontend en `useAuth.tsx`
2. confirmar que las URLs exactas estén permitidas
3. disparar recovery o verify
4. comprobar que el correo lleva al dominio correcto

---

### 5. URL base de invitación

#### Paso
Confirmar base URL usada para construir el link

#### Dónde se hace
- frontend: `SettingsPage.tsx`
- función: `manage-invitation`

#### Valor/secretos necesarios
- `window.location.origin` en producción debe ser `https://compas-hogar.vercel.app`
- `APP_BASE_URL` también debe seguir alineado para otras funciones

#### Cómo verificarlo
1. crear invitación
2. revisar `invitation_url`
3. confirmar que apunte a `https://compas-hogar.vercel.app/invitacion/<token>`

---

## Fase D — Mini plan de rerun posterior

No ejecutar ahora. Solo después de corregir configuración.

### 1. Forgot password
1. crear o usar cuenta limpia
2. disparar `recuperar clave`
3. confirmar recepción real del email
4. abrir link
5. aterrizar en `/restablecer-clave`
6. definir nueva contraseña
7. hacer login con la nueva contraseña

### 2. Invitación por correo
1. crear hogar limpio con owner de prueba
2. crear invitación hacia un inbox real limpio
3. confirmar recepción real del email
4. abrir link
5. crear cuenta o iniciar sesión con el email invitado
6. aceptar invitación
7. confirmar ingreso al hogar correcto

---

## Archivos / puntos relevantes inspeccionados

- [supabase/functions/_shared/email.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/supabase/functions/_shared/email.ts)
- [.env.example](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/.env.example)
- [src/hooks/useAuth.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/hooks/useAuth.tsx)
- [src/features/settings/SettingsPage.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/features/settings/SettingsPage.tsx)
- [src/App.tsx](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/src/App.tsx)

## Conclusión

El bloqueo actual está completamente identificado:

- **Invitaciones por email**: falta configuración SMTP real utilizable en Edge Functions
- **Recovery/reset por email**: falta revisar y normalizar el canal/rate limit de Supabase Auth
- **Redirects**: deben confirmarse explícitamente en URL Configuration de Auth, aunque el código ya los usa correctamente

No hace falta nueva lógica para resolver este bloque.
Hace falta cerrar la configuración externa correcta y recién después rerun corto.
