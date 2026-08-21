# Property Manager — DEMO test guide

Public URL (VPS): `http://69.197.176.243:10047`  
Local: `http://localhost:8081`

This is a **fictional** copy of the production app. Nothing you do here changes real customer data.

## What the application does

Property Manager (Conkreto) is a rental administration tool. You can:

- Register owners, tenants, and real-estate agencies
- Manage apartments and garages
- Create rental contracts (with or without garage)
- Track monthly periods, taxes, index adjustments (IPC/ICL, trimestral / cuatrimestral / semestral), and payments
- First/last month can be prorated if the tenant does not enter on day 1
- Optionally attach a contract PDF (not required); text PDFs can suggest form fields
- Edit EPE/TGI/API/fire flags later, or attach the PDF after create without changing existing fields
- End a contract (who requested it, settlement amount, leave date, optional receipt)
- Review contract history (all contracts, newest first, optional month/property filters)

## DEMO credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `demo.admin@example.com` | `Demo123!` |
| User | `demo.user@example.com` | `Demo123!` |

Both can use the same screens in this DEMO.

## Recommended test

1. Open the DEMO URL and log in with the admin credentials (pre-filled on the login form).
2. Confirm the yellow banner: **DEMO ENVIRONMENT — Fictional Data**.
3. Open **Propiedades**. You should see occupied and available units, plus a rentable garage.
4. Open **Contratos activos**. Filter by month if needed. Pay a pending period, edit taxes, or apply an index on a pesos contract. Lucía’s apartment starts mid-month: the first period is **Proporcional** (paying that amount marks it PAGADO, not PARCIAL). Diego’s garage uses **ICL semestral**.
5. Click **Nuevo contrato** and create a short fictional rental (use an available property/garage and an existing tenant). Optionally attach a **text PDF** and click **Intentar completar desde el PDF** — empty fields only. You can skip the file and attach it later from **Editar / Adjuntar contrato**.
6. Open **Historial de contratos**. All contracts load newest-first with pagination. Month and property filters are optional. Inspect the terminated contract (baja) and its periods. If a row has no file, use **Adjuntar contrato** (saves the PDF only; does not rewrite dates/rent).
7. On an active contract, click **Finalizar**. Fill who requested the leave, leave date, reason, optional settlement, and confirm. The unit stays occupied until that date.
8. Open **Personas** and **Transacciones** to browse owners/tenants and payment history.
9. Click **Reset demo data** on the yellow banner. The fictional dataset is restored.
10. Log out. Optionally log in as `demo.user@example.com`.

## Features worth exploring

- Garage-only rental vs apartment + garage
- Per-contract IPC/ICL index with trimestral, cuatrimestral, or semestral frequency
- Proportional first/last month when occupancy is not a full calendar month
- Optional contract PDF (text PDF autofill on create; later upload does not overwrite fields)
- Edit EPE/TGI/API/fire insurance after the contract already exists
- Contract cancellation with settlement direction and receipt upload
- Period statuses: `PENDIENTE`, `PAGADO`, `PARCIAL`, `CONTRATO_TERMINADO`

## Reset

Use **Reset demo data** (logged in) or:

`POST /api/demo/reset` with `Authorization: Bearer <token>`

This endpoint exists **only** in DEMO.

## How to run DEMO (operators)

```bash
cp .env.demo.example .env.demo
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d --build
```

Stop without touching production:

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml down
```

VPS mapping: public **10047** → inner **8081**.
