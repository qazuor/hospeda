# Umami Dashboards

Umami boards, funnels and goals that replace the PostHog dashboards `00 Resumen` ... `05 Calidad` (HOS-2119). It supersedes the retired PostHog dashboards document.

## Sources of truth

| What | Where |
| --- | --- |
| Funnels and goals | `scripts/umami/definitions.ts` (`HOSPEDA_FUNNELS`, `HOSPEDA_GOALS`) |
| Boards and dropped tiles | `scripts/umami/boards.ts` (`BOARD_SPECS`, `DROPPED_TILES`) |
| Segments and cohorts | `scripts/umami/segment-definitions.ts` (`HOSPEDA_SEGMENTS`, `HOSPEDA_COHORTS`); API client in `scripts/umami/segments-client.ts` |
| Session recorder config (replays and heatmaps) | `scripts/umami/recorder-definitions.ts` (`buildRecorderDefinition`); API client in `scripts/umami/recorder-client.ts` |
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

## Segments and cohorts

Saved audiences for the WEB website, managed by the same script. Both are stored through `POST /api/websites/:websiteId/segments` with `type: 'segment' | 'cohort'` (Umami 3.5). Payloads are typed and validated with a zod schema that mirrors the server's. Cohort events are validated against `AnalyticsEventSchemas` (`UNKNOWN_EVENT` otherwise).

Segments (filters; `any` means a visitor matching at least one filter):

| Segment (name) | Filters |
| --- | --- |
| `Celular y tablet` | device = mobile OR tablet |
| `Escritorio y notebook` | device = desktop OR laptop |
| `Visitantes de Argentina` | country = AR |
| `Visitantes del exterior` | country != AR |
| `Brasil y Uruguay` | country = BR OR UY |
| `Llegan desde Google` | referrer contains `google` |
| `Llegan desde redes sociales` | referrer contains `facebook`, `instagram`, `whatsapp` OR `t.co` |
| `Llegan por campaña (UTM)` | utmSource is not empty |
| `Usuarios logueados` | distinctId is not empty |
| `Navegan fichas de alojamiento` | path contains `/alojamientos/` |
| `Navegan Comer y salir y Experiencias` | path contains `/comer-y-salir/` OR `/experiencias/` |

> **Only `eq`, `neq`, `c` and `dnc` work on segment column filters in Umami 3.5.**
> The set/not-set operators (`s`, `ns`) and the rest (`re`, `gt`, ...) exist only
> for event-data property filters. On a column filter the SQL builder emits broken
> SQL and every stats query answers 500 (`42601 syntax error at or near "group"`).
> "Is not set" cannot be expressed either: `distinctId = ''` matches nothing because
> NULL is not equal to `''`. That is why "Visitantes anónimos" no longer exists, and
> why the definitions' zod schema rejects any other operator at build time.
>
> A `Visitantes anónimos` segment created by an earlier run stays in Umami as
> "unmanaged" until someone deletes it by hand, because the script never deletes.

Cohorts (visitors that fired the event within the window):

| Cohort (name) | Event | Window |
| --- | --- | --- |
| `Vieron un alojamiento (7 días)` | `accommodation_viewed` | 7day |
| `Contactaron a un dueño (30 días)` | `contact_owner_completed` | 30day |
| `Se registraron (30 días)` | `sign_up_completed` | 30day |
| `Publicaron un alojamiento (30 días)` | `accommodation_published` | 30day |
| `Usaron el chat con IA (30 días)` | `ai_chat_opened` | 30day |
| `Empezaron un checkout (30 días)` | `billing_checkout_started` | 30day |
| `Activaron una suscripción (90 días)` | `billing_subscription_activated` | 90day |
| `Empezaron un trial (90 días)` | `trial_started` | 90day |

## Session recorder config

`pnpm umami:setup` also manages the recorder config of the WEB website (HOS-2347): replays
and heatmaps on, sampling 0.5 for both, `strict` masking, 5-minute recordings and the block
selector `[data-umami-block]`. The privacy rules around it are in
[session-replay-privacy.md](./session-replay-privacy.md).

- Umami 3.5 stores it in two `website` columns, `replay_config` and `recorder_enabled`. The
  only write path is `POST /api/websites/:id` with a `replayConfig` object, which Umami
  merges over the stored config. `recorderEnabled` is derived by Umami
  (`replayEnabled || heatmapEnabled`) and is never sent.
- The stored config is sparse: Umami drops `false` booleans and fills absent keys only when
  the recorder reads them (0.15, 0.15, `moderate`, 300000, empty selector). The script
  compares both sides normalized and defaulted, and writes only on a real difference. It
  reports the recorder as `updated` or `unchanged`, with one line per changed field. It is
  never `created`: the website already exists.
- It sends only `replayConfig` with the seven declared keys, never `name`, `domain` or any
  other website field. Keys it does not declare are listed as unmanaged.
- This config does not switch recording on. The operational on/off is the Hospeda switch on
  `/platform/critical`; while it is off, the web never loads `recorder.js`.
- Umami has no retention setting for recordings and never deletes them. See the privacy doc.

## Re-running the script

`pnpm umami:setup` is safe to run as often as you like.

1. A second run with no definition change reports every resource as `unchanged` and sends no write.
2. Adding a definition creates only that one; the existing ones stay `unchanged`.
3. Editing a definition's parameters updates that resource in place (same id) and reports it as `updated`.
4. Anything in Umami that is not in the script, including items made by hand in the UI, is never modified or deleted. After applying, the script lists the reports, boards, segments and cohorts it does not manage under "Unmanaged (left untouched)".
5. A rename is a new definition: it creates a new item, and the old one stays and shows up as unmanaged. Delete it by hand in Umami when you no longer want it. The script never deletes.
6. If more than one item matches a natural key, the script stops with an `ambiguous` error and writes nothing for it.
7. `--dry-run` only reads. It prints what would be created or updated and writes nothing.

## Creating and updating them

```bash
pnpm umami:setup            # create or update funnels, goals, boards, segments, cohorts and the recorder config
pnpm umami:setup --dry-run  # print what would change, write nothing
```

Behavior:

- Idempotent. Reports are matched by `websiteId` + `name`, boards by `name`. Umami has no unique constraint, so the script upserts: a second run changes nothing. More than one match raises an `ambiguous` error instead of guessing.
- Order matters: reports first, boards second. `Funnel` and `Goal` components store the saved report id, so `buildBoardDefinitions` receives the `name -> id` map and throws `UNRESOLVED_REPORT` on a missing name.
- Run it against staging first, then production, with the Umami credentials of that environment (login token or an `umami_...` API key, sent as a bearer credential).
- Segments and cohorts run after boards (boards do not reference them). They are matched by `websiteId` + `type` + `name`.
- The recorder config runs last, after segments. It reads the WEB website and posts only on a difference.
- Renaming a board, report, segment or cohort creates a new one; the old one has to be deleted by hand (see "Re-running the script").

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
