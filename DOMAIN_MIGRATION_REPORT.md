# DOMAIN MIGRATION REPORT — COMPÁS HOGAR

## 1. Estado inicial detectado
- Dominio anterior operativo visible:
  - `https://compas-hogar.vercel.app`
- Dominio antiguo todavía referenciado en configuración sensible antes del cambio:
  - Supabase Auth `site_url` apuntaba a `https://compas-hogar-ajco.vercel.app`
  - `APP_BASE_URL` en secrets de Supabase seguía usando el host viejo
- Referencias encontradas en repo:
  - rutas runtime sensibles usan `window.location.origin` en auth e invitaciones
  - billing usa `APP_BASE_URL` en [supabase/functions/_shared/subscription.ts](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/supabase/functions/_shared/subscription.ts)
  - no se encontraron URLs absolutas activas del dominio viejo en el frontend productivo más allá de docs y `artifacts/`
- Variables críticas encontradas:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `APP_BASE_URL`
  - `MP_WEBHOOK_URL`
- Riesgos detectados antes de tocar nada:
  - recovery y verify podían seguir construyendo redirects válidos solo para el host viejo si Auth no se actualizaba
  - invitaciones por correo podían seguir saliendo con host viejo si la app se abría aún desde el dominio anterior
  - `subscription-return` y manage URLs de billing dependían de `APP_BASE_URL`
  - DNS y SSL aún no estaban cerrados para `compashogar.cl`

## 2. Cambios ejecutados

### Cambios en Vercel
- Dominio agregado al proyecto `compas-hogar`:
  - `compashogar.cl`
  - `www.compashogar.cl`
- Dominio primario efectivo:
  - `https://www.compashogar.cl`
- Redirección del apex implementada en [vercel.json](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/vercel.json):
  - `compashogar.cl` -> `https://www.compashogar.cl`
- El commit de migración fue empujado a `main`, lo que dejó el cambio de dominio también en el repo y no solo local.

### Cambios en Cloudflare
- Zona operada:
  - `compashogar.cl`
- Registros DNS activos creados/corregidos:
  - `A compashogar.cl -> 76.76.21.21`
  - `A www.compashogar.cl -> 76.76.21.21`
- Los registros quedaron sin proxy para no interferir con la verificación/SSL de Vercel durante la activación inicial.

### Cambios en Supabase
- Secret actualizado:
  - `APP_BASE_URL = https://www.compashogar.cl`
- Auth actualizado desde [supabase/config.toml](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/supabase/config.toml):
  - `site_url = https://www.compashogar.cl`
  - redirects permitidos nuevos:
    - `https://www.compashogar.cl/verificar-email`
    - `https://www.compashogar.cl/restablecer-clave`
    - `https://compashogar.cl/verificar-email`
    - `https://compashogar.cl/restablecer-clave`
  - redirects legacy retenidos temporalmente:
    - `https://compas-hogar.vercel.app/...`
    - `https://compas-hogar-ajco.vercel.app/...`
- Incidente operativo durante la ejecución:
  - hubo un `supabase config push` inicial lanzado con `workdir` incorrecto que intentó empujar defaults locales de desarrollo a Auth
  - fue corregido de inmediato con un segundo `config push` desde la raíz correcta del repo
  - el estado final quedó restaurado y alineado al dominio oficial

### Cambios en código
- [vercel.json](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/vercel.json)
  - redirect host-level apex -> `www`
- [supabase/config.toml](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/supabase/config.toml)
  - `site_url` y redirect URLs actualizados
- [\.gitignore](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/.gitignore)
  - agregado `.vercel`

### Cambios en variables de entorno
- No fue necesario agregar nuevas env vars en Vercel.
- Sí fue necesario actualizar el secret productivo `APP_BASE_URL` en Supabase para que los retornos de billing dejen de depender del host anterior.

### Cambios en callbacks / billing
- `subscription-return` quedó sirviendo:
  - CTA `<a>` hacia `https://www.compashogar.cl/app/suscripcion`
  - redirect automático por script hacia `https://www.compashogar.cl/app/suscripcion`
- No se detectaron referencias restantes al dominio viejo dentro de esa respuesta HTML.
- `MP_WEBHOOK_URL` no se modificó porque sigue operando contra Supabase Functions y no depende del host público del frontend.

## 3. Archivos modificados
- [vercel.json](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/vercel.json)
  - redirección permanente del apex hacia `www`
- [supabase/config.toml](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/supabase/config.toml)
  - `site_url` y redirects permitidos de Auth
- [\.gitignore](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/.gitignore)
  - ignorar `.vercel`
- [DOMAIN_MIGRATION_REPORT.md](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/DOMAIN_MIGRATION_REPORT.md)
  - informe operativo final

## 4. Validaciones ejecutadas

| Prueba | Resultado | Evidencia breve | Riesgo residual |
| --- | --- | --- | --- |
| Home pública en `www` | PASS | `https://www.compashogar.cl` respondió `200` | bajo |
| Login en `www` | PASS | `https://www.compashogar.cl/login` respondió `200` sin referencias HTML al dominio viejo | bajo |
| Redirect apex -> `www` | PASS | `https://compashogar.cl` respondió `308` hacia `https://www.compashogar.cl/` | bajo |
| Registro | PASS | cuenta temporal creada en el host nuevo y luego limpiada | bajo |
| Login / logout | PASS | cuenta temporal inició sesión, cerró sesión y volvió a entrar correctamente | bajo |
| Recovery por correo | FAIL | la solicitud salió, pero no llegó correo al inbox real dentro de la ventana de prueba | alto |
| Invitación por correo | PASS | correo enviado y recibido; `invitation_url` ya salió como `https://www.compashogar.cl/invitacion/...` | bajo |
| Aceptación de invitación | PASS | `preview-invitation = pending` y `accept-invitation = success` en el dominio nuevo | bajo |
| Resolución owner del hogar correcto | PASS | corrida mínima limpia devolvió `ownerResolved === householdId` | bajo |
| Resolución miembro invitado del hogar correcto | PASS | corrida mínima limpia devolvió `memberResolved === householdId` | bajo |
| CRUD principal no roto | PASS | movimiento temporal creado, editado y eliminado; `deleted_at != null` confirmado | bajo |
| Gating por plan / acceso premium | PASS | hogar beta `plus / active / monthly` pudo crear recurrencia y categoría custom | bajo |
| Callback visible de suscripción | PASS | `subscription-return` ya devuelve CTA y redirect a `https://www.compashogar.cl/app/suscripcion` | bajo |
| Referencias al dominio viejo en callbacks | PASS | `subscription-return` ya no contiene `compas-hogar.vercel.app` ni `compas-hogar-ajco.vercel.app` | bajo |
| Redirecciones inesperadas al dominio viejo | PASS | home, login, invitación y callback inspeccionados sin saltos al host viejo | bajo |
| Flujo de checkout end-to-end post-migración | PARTIAL | callbacks y URLs quedaron alineados; no se inició un nuevo cobro real en esta iteración para no generar ruido comercial | medio |

## 5. Pendientes manuales
- Repetir recovery por correo con una ventana de observación más larga o con inbox alternativo si se quiere cerrar entregabilidad del proveedor después del cambio de dominio.
- Opcional, después de un período de estabilidad:
  - remover redirects legacy del dominio viejo en Supabase Auth si ya no se quiere mantener compatibilidad temporal

## 6. Rollback
- Si algo falla, revertir en este orden:
  1. Supabase secret `APP_BASE_URL` de vuelta al dominio anterior
  2. Supabase Auth `site_url` y `additional_redirect_urls` al host anterior
  3. quitar o revertir la redirección apex -> `www` en [vercel.json](C:/Users/ica_r/OneDrive/Documentos/Playground/compas-hogar/vercel.json)
  4. si fuera necesario, dejar el tráfico operativo solo en `https://compas-hogar.vercel.app`
- No es necesario borrar inmediatamente `compashogar.cl` de Vercel o Cloudflare para recuperar operación; basta con volver a alinear URLs y redirects.

## 7. Commit final
- Commit que llevó la migración de dominio al repo:
  - `6fa0c6b`
- Mensaje:
  - `Prepare official domain migration to compashogar.cl`
