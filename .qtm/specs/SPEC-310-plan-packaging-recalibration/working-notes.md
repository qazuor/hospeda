# C1 — Recalibración de entitlements y límites por plan

> Estado: **TOURIST = decidido** · **OWNER = propuesta en revisión** (inventario de features en curso) · **COMPLEX = ocultar**.

## Contexto y alcance

- **complex** se OCULTA (opción A: `isActive:false` + UPDATE SQL, reversible). No se recalibra.
- **C1** = saneamiento del *packaging*: eliminar entitlements obsoletos, ocultar complex, recalibrar límites, mover features de tier, fijar la tabla objetivo de cada plan. Es la fuente de verdad del packaging.
- **Las features fantasma NO se ocultan**: se implementan vía specs (roadmap abajo). La tabla pública sigue mostrándolas.
- **Fuera de C1**: cupos de IA *consumer* (`MAX_AI_SEARCH`, `MAX_AI_CHAT_CONSUMER`) → SPEC-283. Marcados `[283]`.
- owner hereda todo tourist-VIP (SPEC-216).

**Leyenda**: `✓` otorgado · `-1` ilimitado · `[283]` lo fija SPEC-283 · 🟡 construido sin merge · ❌ fantasma (a implementar).

---

## TOURIST — DECIDIDO

Se mantienen 3 tiers (free / plus / vip). vip gana features propias reales al implementar sus 3 exclusivas.

## TOURIST FREE ($0)

**Entitlements**: `SAVE_FAVORITES` · `READ_REVIEWS` · `WRITE_REVIEWS`
*(se quita `CAN_VIEW_RECOMMENDATIONS` → pasa a plus)*

| Límite | Valor |
|---|---|
| MAX_FAVORITES | 5 |
| MAX_AI_SEARCH `[283]` | 10 |
| MAX_AI_CHAT_CONSUMER `[283]` | 10 |

## TOURIST PLUS ($5)

Hereda free +:

| Entitlement | Estado |
|---|---|
| CAN_COMPARE_ACCOMMODATIONS | 🟡 SPEC-288 (sin merge) |
| CAN_VIEW_SEARCH_HISTORY | 🟡 SPEC-289 (sin merge) |
| CAN_VIEW_RECOMMENDATIONS | ❌ → spec |
| PRICE_ALERTS | ❌ → spec |
| EXCLUSIVE_DEALS | ❌ → spec |
| CAN_ATTACH_REVIEW_PHOTOS | ❌ → spec |
| CAN_CONTACT_WHATSAPP_DISPLAY | ❌ → spec |

*(se elimina `AD_FREE` del catálogo — obsoleto)*

| Límite | Valor |
|---|---|
| MAX_FAVORITES | 25 |
| MAX_COMPARE_ITEMS | 3 *(subir de 2 — coord SPEC-288)* |
| MAX_SEARCH_HISTORY_ENTRIES | 50 |
| MAX_ACTIVE_ALERTS | 5 |
| MAX_AI_SEARCH `[283]` | 50 |
| MAX_AI_CHAT_CONSUMER `[283]` | 50 |

## TOURIST VIP ($15)

Hereda plus +:

| Entitlement | Estado |
|---|---|
| CAN_CONTACT_WHATSAPP_DIRECT | ❌ → spec |
| VIP_SUPPORT | ❌ → spec |
| VIP_PROMOTIONS_ACCESS | ❌ → spec |

| Límite | Valor |
|---|---|
| MAX_FAVORITES | -1 |
| MAX_COMPARE_ITEMS | 5 *(de 4 — coord SPEC-288)* |
| MAX_SEARCH_HISTORY_ENTRIES | 200 |
| MAX_ACTIVE_ALERTS | -1 |
| MAX_AI_SEARCH `[283]` | 200 |
| MAX_AI_CHAT_CONSUMER `[283]` | 200 |

## Eliminaciones tourist

- **`AD_FREE`** (entitlement obsoleto — no hay sistema de ads que desactivar).

## Roadmap de specs tourist (features prometidas a construir)

- **Ya construidas, faltan mergear**: SPEC-288 (comparador), SPEC-289 (search-history).
- **A crear**: whatsapp (display+direct) · price-alerts · exclusive-deals · review-photos · recommendations · vip-support · vip-promotions.

---

## COMPLEX — OCULTAR (no recalibrar)

complex-basico/pro/premium → `isActive:false` + UPDATE SQL en staging/prod. Código/tipos/enum intactos para reactivar cuando se implemente la vertical. Test users complex dev: se quedan.

---

## OWNER — DECIDIDO (límites a confirmar en los 3 puntos abiertos)

Estado real de features owner:

- ✅ **Funciona**: publish, edit, basic-stats, advanced-stats, rich-description, embed-video, AI chat/translate/import.
- 🟡 **Parcial**: featured-listing (admin-activado, sin auto) · create-promotions (display turista en PR #1900 sin merge) · ai-text-improve (falta botón en editor web).
- ❌ **Fantasma**: respond-reviews, custom-branding, verification-badge, calendar, sync-calendar, whatsapp display/direct, priority-support.

Decisiones de features owner:

- **calendar + sync-calendar**: PENDIENTE de definición (modelo de disponibilidad sin booking). Ni eliminar ni construir aún.
- **priority-support**: promesa operacional (sin código). Se cumple con atención prioritaria real, no es item de roadmap.
- **owner-premium gana exclusivas reales**: custom-branding + verification-badge → se construyen (specs).
- Resto fantasma/parcial → roadmap de specs (no se ocultan de la tabla).

## OWNER BÁSICO ($15) — hereda tourist-VIP

| Cupo / Feature | Actual | Nuevo |
|---|---|---|
| MAX_ACCOMMODATIONS | 1 | 1 *(punto abierto #3)* |
| MAX_PHOTOS / aloj. | 5 | 15 |
| CREATE_PROMOTIONS | ✗ | ✓ |
| MAX_ACTIVE_PROMOTIONS | 0 | 2 |
| FEATURED_LISTING | ✗ | ✗ (upsell pro — punto abierto #1) |
| AI text-improve | 20 | 50 |
| AI chat (owner) | 20 | 50 |
| AI translate | 200 | 200 |
| AI import | 200 | 10 *(punto abierto #2)* |

## OWNER PRO ($35) — hereda básico + (advanced-stats✅, priority-support[op], featured🟡, rich-desc✅, video✅, sync-cal⏳)

| Cupo | Actual | Nuevo |
|---|---|---|
| MAX_ACCOMMODATIONS | 3 | 3 |
| MAX_PHOTOS / aloj. | 15 | 30 |
| MAX_ACTIVE_PROMOTIONS | 3 | 5 |
| AI text-improve | 100 | 250 |
| AI chat (owner) | 100 | 250 |
| AI translate | 500 | 1000 |
| AI import | 500 | 50 |

## OWNER PREMIUM ($75) — hereda pro + (custom-branding❌→spec, verification-badge❌→spec)

| Cupo | Actual | Nuevo |
|---|---|---|
| MAX_ACCOMMODATIONS | 10 | 10 |
| MAX_PHOTOS / aloj. | 30 | 50 |
| MAX_ACTIVE_PROMOTIONS | -1 | -1 |
| AI text-improve | 1000 | 1250 |
| AI chat (owner) | 2000 | 1250 |
| AI translate | 2000 | 5000 |
| AI import | 2000 | 250 |

Escalera IA owner-side ×5 parejo: text/chat 50/250/1250 · translate 200/1000/5000 · import 10/50/250.

## Puntos abiertos owner (revisá/editá acá)

1. `FEATURED_LISTING` en básico: queda upsell pro (recomendado). → cambiá si lo querés en básico.
2. AI import recortado (básico 200→10): recomendado por ser puntual. → ajustá si te parece bajo.
3. owner-básico MAX_ACCOMMODATIONS = 1: recomiendo dejar 1 (host individual). → subí a 2 si querés más generoso.

---

## ROADMAP DE SPECS (features prometidas → construir)

**Acciones (no specs):** mergear SPEC-288 (comparador), SPEC-289 (search-history), PR #1900 (promotions display).
**Operacional (sin código):** priority-support (owner), vip-support (tourist) — atención prioritaria real.
**Pendiente de definición:** calendar + sync-calendar (owner).

**Specs a crear (stubs de backlog):**

| # | Spec | Para |
|---|---|---|
| 1 | whatsapp-contact (display+direct) | tourist plus/vip + owner |
| 2 | price-alerts | tourist plus/vip |
| 3 | exclusive-deals | tourist plus/vip |
| 4 | review-photos | tourist plus/vip |
| 5 | recommendations | tourist plus/vip |
| 6 | vip-promotions-access | tourist vip |
| 7 | respond-reviews | owner |
| 8 | custom-branding | owner premium |
| 9 | verification-badge | owner premium |
| 10 | featured-listing-automation (auto-activar + self-service) | owner |
| 11 | ai-text-improve en editor web | owner (chica, podría ser NOSPEC) |

## ELIMINACIONES

- `AD_FREE` (tourist) — entitlement obsoleto.
