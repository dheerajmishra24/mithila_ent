# TRAI DLT Operations Checklist

> **Status (2026-11-27):** the only SMS in code is the owner-portal sign-in code fallback (MSG91 Flow API, `src/lib/messaging/dlt-sms.ts`). It stays off until `MSG91_AUTH_KEY` and `MSG91_OTP_TEMPLATE_ID` are set, and it sends exactly the "Login / verification OTP" template below, with the code as the only variable. See `docs/ADMIN_TWO_STEP.md`. This checklist must be complete before any SMS goes live. Operators drop unregistered SMS without telling the sender.
> Owner fills in the blanks. Keep IDs here; never put API keys or passwords in this file.

## 1. Registration

| Item | Value | Done |
|---|---|---|
| Principal Entity (PE) ID | `________________` | ☐ |
| DLT operator portal used (Jio / Airtel / Vi / BSNL) | `________________` | ☐ |
| 6-character sender header (brand-linked, e.g. `MITHLA`) | `______` | ☐ |
| Header suffix shown to customers (`-T` transactional, `-S` service, `-P` promotional, `-G` government) | `-T` / `-S` | ☐ |
| Telemarketer / aggregator (TM) and its TM ID | `________________` | ☐ |
| PE–TM chain binding declared on the portal (max 2 TMs) | ☐ | ☐ |
| Annual self-certification date | `____-__-__` | ☐ |

## 2. Templates (typed variables only)

The November 2025 TRAI direction replaces the generic `{#var#}` placeholder with typed tags. Register each template exactly as below, then record its template ID.

| Purpose | Category | Template text to register | Template ID |
|---|---|---|---|
| Login / verification OTP | Service-Implicit | `{#numeric#} is your Mithila Enterprises verification code. It expires in 10 minutes. Do not share it with anyone. -MITHLA` | `________` |
| Order confirmed | Service-Implicit | `Your Mithila Enterprises order {#alphanumeric#} for Rs {#numeric#} is confirmed. Track it at #url# -MITHLA` | `________` |
| Order shipped | Service-Implicit | `Order {#alphanumeric#} has shipped via {#alphanumeric#}, AWB {#alphanumeric#}. Track: #url# -MITHLA` | `________` |
| COD confirmation | Service-Implicit | `{#numeric#} is the code to confirm your cash-on-delivery order {#alphanumeric#}. Ignore if you did not order. -MITHLA` | `________` |
| Call-back number (if used) | — | `... call us on #cbn# ...` | `________` |

Rules:
- [ ] No template contains `{#var#}`.
- [ ] Code that sends SMS fills variables in the registered order and sends the template ID with each message.
- [ ] OTP digits use `{#numeric#}`; order IDs use `{#alphanumeric#}`; links use `#url#`; phone numbers use `#cbn#`.

## 3. URLs and call-back numbers

| Item | Value | Done |
|---|---|---|
| Whitelisted domain(s) for `#url#` (full domain, no shorteners unless registered) | `www.mithilaenterprises.co.in` | ☐ |
| Whitelisted call-back number(s) | `________________` | ☐ |

## 4. Ongoing

- [ ] Review templates every 90 days. Templates unused for 90 days get suspended.
- [ ] Renew the annual self-certification.
- [ ] Remember that Service-Explicit templates were folded into Promotional on 10 Mar 2026. Do not register marketing text as Service.
- [ ] The weekly scheduled audit (Step 7) reminds the owner about the self-certification date.
