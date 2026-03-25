import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

  const title = status === 'success' ? 'Suscripcion procesada' : 'Volver a Casa Clara';
  const description = status === 'success'
    ? 'Mercado Pago ya termino el flujo. Vuelve a tu app local de Casa Clara y recarga la pantalla de suscripcion.'
    : 'El flujo de Mercado Pago termino con un estado distinto. Vuelve a tu app local y revisa el estado de la suscripcion.';

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
        --accent: #1278a6;
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
      ol {
        margin: 24px 0 0;
        padding-left: 20px;
        color: var(--text);
      }
      li {
        margin-bottom: 12px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      ${preapprovalId ? `<p>ID de suscripcion: <code>${escapeHtml(preapprovalId)}</code></p>` : ''}
      <ol>
        <li>Vuelve a la pestaña donde tienes abierta tu app local de Casa Clara.</li>
        <li>Recarga la pantalla de suscripcion o entra de nuevo a <code>http://localhost:5173/app/suscripcion</code>.</li>
        <li>Si el cobro ya fue autorizado, el estado se actualizara por webhook.</li>
      </ol>
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
