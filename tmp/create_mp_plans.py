import http.client
import json

ACCESS_TOKEN = "TEST-8635645702237613-032122-dde46ed9d836fbfac5d1424275dcf3cf-66683585"

plans = [
    {
        "name": "Casa Clara - Plan Base Mensual",
        "description": "Todo lo esencial para ordenar el dinero de tu hogar.",
        "amount": 2990,
        "frequency": 1,
        "frequency_type": "months",
        "env_key": "MP_PLAN_BASE_MONTHLY"
    },
    {
        "name": "Casa Clara - Plan Plus Mensual",
        "description": "Para hogares que quieren ir un paso más allá.",
        "amount": 4990,
        "frequency": 1,
        "frequency_type": "months",
        "env_key": "MP_PLAN_PLUS_MONTHLY"
    },
    {
        "name": "Casa Clara - Plan Plus Anual",
        "description": "Para hogares que quieren ir un paso más allá (Anual).",
        "amount": 49900,
        "frequency": 12,
        "frequency_type": "months",
        "env_key": "MP_PLAN_PLUS_YEARLY"
    }
]

def create_plan(plan_data):
    conn = http.client.HTTPSConnection("api.mercadopago.com")
    payload = json.dumps({
        "reason": plan_data["name"],
        "auto_recurring": {
            "frequency": plan_data["frequency"],
            "frequency_type": plan_data["frequency_type"],
            "transaction_amount": plan_data["amount"],
            "currency_id": "CLP"
        },
        "back_url": "https://casaclara.app/app/suscripcion?status=success",
        "status": "active"
    })
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {ACCESS_TOKEN}'
    }
    conn.request("POST", "/preapproval_plan", payload, headers)
    res = conn.getresponse()
    data = res.read()
    return json.loads(data.decode("utf-8"))

results = {}
for p in plans:
    print(f"Creando {p['name']}...")
    resp = create_plan(p)
    if "id" in resp:
        print(f"SUCCESS: {p['env_key']} = {resp['id']}")
        results[p['env_key']] = resp['id']
    else:
        print(f"ERROR en {p['name']}: {resp}")

print("\n--- RESUMEN DE IDs ---")
for k, v in results.items():
    print(f"{k}: {v}")
