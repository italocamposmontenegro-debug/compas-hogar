import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildSubscriptionManageUrl } from '../_shared/subscription.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'success';
  const preapprovalId = url.searchParams.get('preapproval_id') ?? url.searchParams.get('preapproval') ?? '';
  const manageUrl = buildSubscriptionManageUrl();

  const title = status === 'success' ? 'Suscripción procesada' : 'Volver a Compás Hogar';
  const description = status === 'success'
    ? 'Mercado Pago ya terminó el flujo. Vuelve a Compás Hogar para revisar el estado del plan y confirmar el acceso.'
    : 'El flujo de Mercado Pago terminó con un estado distinto. Vuelve a Compás Hogar para revisar la suscripción.';

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f2ea;
        --card: #fffdf8;
        --text: #173b45;
        --muted: #5c7177;
        --accent: #0f5963;
        --border: #d8d0bf;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #fffdf8 0%, var(--bg) 65%);
        font-family: "Segoe UI", system-ui, sans-serif;
        color: var(--text);
        padding: 24px;
      }
      main {
        width: min(640px, 100%);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 18px 50px rgba(23, 59, 69, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 4vw, 40px);
        line-height: 1.05;
      }
      p {
        margin: 0 0 16px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.5;
      }
      code {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: #eef5f7;
        color: var(--text);
        font-size: 14px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 12px;
        background: var(--accent);
        color: white;
        text-decoration: none;
        font-weight: 700;
      }
      p.helper {
        margin-top: 16px;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      ${preapprovalId ? `<p>ID de suscripcion: <code>${escapeHtml(preapprovalId)}</code></p>` : ''}
      <div class="actions">
        <a class="button" href="${escapeHtml(manageUrl)}">Abrir suscripción</a>
      </div>
      <p class="helper">Si el cobro ya fue autorizado, el estado debería actualizarse por webhook. Si no ves el cambio, usa la opción de sincronizar estado dentro de la app.</p>
      <script>
        window.setTimeout(() => {
          window.location.href = ${JSON.stringify(manageUrl)};
        }, 3500);
      </script>
    </main>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    status: 200,
  });
});
