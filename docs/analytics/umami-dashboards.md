# Umami Dashboards

Umami boards, funnels and goals that replace the PostHog dashboards `00 Resumen` ... `05 Calidad` (HOS-2119). It supersedes the retired PostHog dashboards document.

## Sources of truth

| What | Where |
| --- | --- |
| Funnels and goals | `scripts/umami/definitions.ts` (`HOSPEDA_FUNNELS`, `HOSPEDA_GOALS`) |
| Boards and dropped tiles | `scripts/umami/boards.ts` (`BOARD_SPECS`, `DROPPED_TILES`) |
| API shapes measured on Umami 3.5.0 | `.specs/HOS-2119-posthog-to-umami/docs/umami-spike-findings.md` |
| Event names and properties | `packages/analytics/src/catalog.ts`, [event-catalog.md](./event-catalog.md) |
| PostHog originals (retired) | Removed in HOS-2119; see git history of `scripts/posthog/data.ts` |

Every funnel step and goal is validated against `AnalyticsEventSchemas`; a name that is not in the catalog makes the build throw `UNKNOWN_EVENT`.

## Boards

Six `website` boards, one per former PostHog dashboard. Board names are the natural keys used by the setup script.

Component legend:

| Component | Shows |
| --- | --- |
| `WebsiteMetricsBar` | Pageviews, visitors, visits of the selected range |
| `WebsiteChart` | Visitors over time |
| `EventsMetricsBar` / `EventsChart` | ALL custom events (no props, no per-event filter) |
| `MetricsTable` | Top values of one dimension (`referrer`, `entry`, `utmSource`, `utmCampaign`, `event`, ...) |
| `Goal` / `Funnel` | A saved report (see below) |

| Board | Purpose | Components |
| --- | --- | --- |
| `00 Resumen` | Executive overview | Metrics bar; visitors chart; Goals: Registros completados, Alojamientos publicados, Contactos completados, Suscripciones activadas; Funnels: Registro → publicado, Vista → contacto |
| `01 Adquisición` | Sources and conversion | Metrics bar; visitors chart; tables: referrer, landing pages (`entry`), UTM source, UTM campaign; Goals: Registros completados, Contactos completados |
| `02 Descubrimiento` | Content views, searches, contact | Events metrics bar; events chart; events table (top 20); Goal: Contactos completados; Funnels: Vista → contacto, Contacto (3 pasos) |
| `03 Owners` | Onboarding to publication | Events metrics bar; events chart; events table (top 20); Goal: Alojamientos publicados; Funnel: Owner adquisición → publicación |
| `04 Suscripciones` | Checkout, activation, charges, trials | Events metrics bar; events chart; events table (top 20); Goals: Suscripciones activadas, Pagos exitosos, Trials convertidos a pago; Funnel: Suscripción |
| `05 Calidad` | Failures affecting conversion | Events chart (includes `*_failed` and `billing_charge_declined`); events table (top 20); Funnels: Owner adquisición → publicación, Contacto (3 pasos) |

The events table (`MetricsTable`, `type: event`) is the replacement for per-event trend tiles: it lists every event with its count. It is not filtered per board, so a board's title names the events it is meant for.

Rendering was verified at the API level only (boards created, read back, deleted); no browser check yet.

## Funnels

Five funnels, deduplicated from the 8 PostHog funnel insights (3 pairs were repeated across dashboards). Window is in **minutes**: the default is `20160` (14 days, the PostHog default), measured on Umami 3.5.0.

| Funnel (report name) | Steps | Window (min) |
| --- | --- | --- |
| `Funnel · Registro → alojamiento publicado` | `sign_up_completed` → `accommodation_published` | 20160 |
| `Funnel · Vista de alojamiento → contacto` | `accommodation_viewed` → `contact_owner_completed` | 20160 |
| `Funnel · Contacto de alojamiento (3 pasos)` | `accommodation_viewed` → `contact_owner_started` → `contact_owner_completed` | 20160 |
| `Funnel · Owner adquisición → publicación` | `sign_up_started` → `sign_up_completed` → `onboarding_started` → `accommodation_published` | 20160 |
| `Funnel · Suscripción` | `billing_checkout_started` → `billing_subscription_activated` → `billing_charge_succeeded` | 20160 |

Note: the spec mentions "nine funnels"; the retired `scripts/posthog/data.ts` only ever had 8 funnel insights (5 distinct). None were invented.

## Goals

Six goals on a single catalog event. **A goal is the share of visitors that fired the event, not an event count.** A visitor who signs up three times counts once.

| Goal (report name) | Event |
| --- | --- |
| `Goal · Registros completados` | `sign_up_completed` |
| `Goal · Alojamientos publicados` | `accommodation_published` |
| `Goal · Contactos completados` | `contact_owner_completed` |
| `Goal · Suscripciones activadas` | `billing_subscription_activated` |
| `Goal · Pagos exitosos` | `billing_charge_succeeded` |
| `Goal · Trials convertidos a pago` | `trial_converted` |

## Creating and updating them

```bash
pnpm umami:setup            # create or update funnels, goals and boards
pnpm umami:setup --dry-run  # print what would change, write nothing
```

> The `umami:setup` package script lands with T-041. Until then the definitions exist but nothing applies them.

Behavior:

- Idempotent. Reports are matched by `websiteId` + `name`, boards by `name`. Umami has no unique constraint, so the script upserts: a second run changes nothing. More than one match raises an `ambiguous` error instead of guessing.
- Order matters: reports first, boards second. `Funnel` and `Goal` components store the saved report id, so `buildBoardDefinitions` receives the `name -> id` map and throws `UNRESOLVED_REPORT` on a missing name.
- Run it against staging first, then production, with the Umami credentials of that environment (login token or an `umami_...` API key, sent as a bearer credential).
- Renaming a board or report creates a new one; the old one has to be deleted by hand.

## PostHog → Umami gap list

Source: `DROPPED_TILES` in `scripts/umami/boards.ts` (17 entries) and the T-038 mapping.

Reason codes:

- **NO-EVENT-PROP**: Umami has no board component or saved report that breaks an event down by a custom event property (the `breakdown` report only accepts fixed columns such as `path`, `referrer`, `title`).
- **NO-PERSON**: Umami has no person properties.
- **NO-PER-EVENT**: no component charts or counts ONE custom event. `EventsChart` and `EventsMetricsBar` take no props and cover all events; only conversion events have a Goal.

Replacements: **event-data** = an Umami `event-data` read of the property, or an admin page reading the Hospeda DB. **Events table** = the `MetricsTable` of events on the same board.

| Board | PostHog tile | Reason | Replacement |
| --- | --- | --- | --- |
| 00 Resumen | Visitantes activos mensuales (MAU) | No rolling MAU metric | Metrics bar: unique visitors of the selected range |
| 00 Resumen | Conversión visitante → registro | A funnel needs a concrete first step; no "any pageview" step | Goal `Registros completados` (share of visitors that signed up) |
| 00 Resumen | Pageviews 30d / Evolución diaria (DAU) | No DAU math mode; range is chosen on the board | `WebsiteMetricsBar` and `WebsiteChart` |
| 00 Resumen | Top destinos por visitantes | NO-EVENT-PROP | event-data |
| 00 Resumen | Top alojamientos por contactos | NO-EVENT-PROP | event-data |
| 00 Resumen | Registros / Alojamientos publicados / Contactos / Suscripciones creadas 30d | A Goal is a share of visitors, not an event count | Goals of the same names plus the events table |
| 01 Adquisición | Pageviews / Registros / Contactos 30d | Single-event trends have no component | Metrics bar, visitors chart and the sign-up and contact Goals |
| 02 Descubrimiento | Búsquedas, vistas de destinos/alojamientos/eventos/posts, contactos iniciados 30d | NO-PER-EVENT | Events table |
| 02 Descubrimiento | Contactos por destino | NO-EVENT-PROP | event-data |
| 02 Descubrimiento | Contactos por alojamiento | NO-EVENT-PROP | event-data |
| 03 Owners | Inicios de onboarding, drafts, importaciones completadas/fallidas 30d | NO-PER-EVENT | Events table |
| 03 Owners | Publicaciones por plan | NO-PERSON | Admin page reading the DB (plan lives in billing tables) |
| 04 Suscripciones | Checkouts iniciados, pagos fallidos 30d | NO-PER-EVENT | Events table |
| 04 Suscripciones | Suscripciones por plan | NO-EVENT-PROP | event-data |
| 04 Suscripciones | Suscripciones por período | NO-EVENT-PROP | event-data |
| 05 Calidad | Contactos fallidos, importaciones fallidas, pagos fallidos 30d | NO-PER-EVENT | Events table |
| 05 Calidad | Pagos fallidos por categoría | NO-EVENT-PROP | event-data |

### Gaps by class

| Class | PostHog | Umami |
| --- | --- | --- |
| Event-property breakdowns | `destination_slug`, `accommodation_id`, `destination_id`, `plan_slug`, `billing_period`, `failure_category` | Dropped; use event-data or an admin page |
| Person-property breakdowns | `plan` | Dropped; Umami has no person properties |
| MAU / DAU math | Rolling MAU, daily active users | Visitors of the selected range |
| Per-event trend tiles | One trend per event (search, views, drafts, imports, failures, ...) | Events chart/bar for all events plus the events table; no per-event filter |
| Pageview → sign-up funnel | `$pageview` → `sign_up_completed` | Goal `Registros completados` |
| Goal semantics | Event counts for conversion KPIs | Share of visitors (unique), not counts |
| HogQL SQL insights | None existed in the ported set | n/a |

### Billing event renames

Billing events were renamed by HOS-1352. The builders reject the old names.

| PostHog (old) | Catalog (current) |
| --- | --- |
| `subscription_checkout_started` | `billing_checkout_started` |
| `subscription_created` | `billing_subscription_activated` |
| `subscription_payment_succeeded` | `billing_charge_succeeded` |
| `subscription_payment_failed` | `billing_charge_declined` |
| `trial_converted_to_paid` | `trial_converted` |

See [event-migrations.md](./event-migrations.md) for the full mapping.

## Not on boards: owner traffic stats

The per-listing statistics shown to owners (referrers, countries, devices, the contact funnel, and the "Desde Hospeda" vs "Directo" split driven by `listing_internal_entry`) are served by the **api**, not by these boards. They read Umami through the api adapter (per-listing tags, `metrics/expanded` for distinct visitors) and are scoped per owner. The boards above are internal, staff-facing and website-wide.
