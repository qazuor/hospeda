# Half B · Vertical-specific features — complete

**Measured** 2026-09-01 against `origin/staging`; **decided** 2026-09-01 by the
owner. Measurement columns are **MEASURED** with file:line evidence; the decision
column carries the owner's verdicts, all 13 of them.

Half B is where a premium tier can find a reason to exist that is not "the same
but more expensive". It asks what a restaurant or an excursion has that a cabin
does not.

## The finding that reorders everything

**Owners already fill in data that no public page shows.**

Both verticals carry amenities and features — a catalogue seeded with rows scoped
to them via `applicableVerticals`, the M:N link tables, and a dedicated owner
editor (`apps/web/src/components/commerce/editor/AmenitiesSection.client.tsx`).
The chain then breaks in three places at once:

| Link | Accommodation | Gastronomy | Experiences |
|---|---|---|---|
| Catalogue rows exist | ✅ | ✅ | ✅ |
| M:N tables | ✅ | ✅ | ✅ |
| Owner can fill them in | ✅ | ✅ | ✅ |
| Public (`access`) schema exposes them | ✅ | ❌ | ❌ |
| Page requests them from the API | ✅ (4 call sites) | ❌ | ❌ |
| A component renders them | ✅ `AmenitiesGrid.astro` | ❌ | ❌ |

Verified three independent ways: only `accommodation.access.schema.ts` mentions
amenities/features; the only call sites passing `includeAmenities: true` /
`includeFeatures: true` are the four accommodation pages; and no commerce
component renders them. `ExperienceInfo.astro` **claims** to in its own JSDoc —
*"Renders opening hours, social networks, amenities/features, and contact info"* —
and that line is the only place the word appears in the file.

So an owner ticks "transport included", "guide speaks English", "accepts cards",
"delivery", saves — and none of it reaches their listing. Their work is discarded
silently.

**Why this reorders Half B**: several candidates below are not features to build.
The data is already stored, already typed by the owner, and merely never shown.
That is a rendering gap, not a modelling one — no migration, no new model.

## Gastronomy

| # | Candidate | Exists today | Cost | Decision | Notes |
|---|---|---|---|---|---|
| 1 | **The menu** | Partially — one text input requiring an `https` URL | MEDIUM–LARGE | `TIER: pro` | HOS-895 confirmed verbatim: no photo, no PDF, no structured model with sections and prices. A real menu is a whole feature — and it is what people actually look for in a restaurant. |
| 2 | **Shifts and opening hours** | Yes, and healthier than reported | SMALL | `TIER: basic` | Of the three issues cited, **HOS-814 and HOS-825 are already fixed** (tests cite them by number). **HOS-906 is still live**, with a located root cause: `DayScheduleSchema` accepts `{closed: false, shifts: []}` with no cross-field refine, so a day can be neither open nor closed. A `.superRefine` closes it. |
| 3 | **Table booking** | No booking flow | LARGE | `TIER: premium` | Only an `accepts_reservations` tick in the shared catalogue — and even that is not shown to visitors today (see the finding above). Real booking means a new model with states. |
| 4 | **Cuisine type** | **No** | SMALL–MEDIUM | `LISTING DATA` | Confirmed with two search conventions. `type` is the venue category (9 values: RESTAURANT/BAR/CAFE/PARRILLA/…), not a culinary style. Could be catalogue rows rather than a column. |
| 5 | **Price range** | **Complete end to end** | — | `LISTING DATA` | `priceRange`, 4 tiers, the only candidate with no gaps anywhere in the chain. No separate numeric cover charge exists. |
| 6 | **Payment methods / delivery / takeaway** | Stored, not shown | SMALL | `LISTING DATA` | `accepts_cards`, `delivery`, `takeaway` already exist as catalogue rows. `accepts_cards` is a single generic boolean, not granular per method. Same visibility gap. |

## Experiences

The six scalar fields are genuinely absent — confirmed with two naming
conventions each, plus a negative control (`priceFrom` does appear, so the search
technique works). But "absent" splits in two, and the split is the point.

| # | Candidate | Exists today | Cost | Decision | Notes |
|---|---|---|---|---|---|
| 1 | **Duration** | **No** — not in the form, not in the database | SMALL | `LISTING DATA` | HOS-898. Probably the single most-asked fact about an excursion, and it cannot be entered. |
| 2 | **Capacity per departure** | **No** | SMALL–MEDIUM | `LISTING DATA` | Depends on whether it is informational or enforced against bookings. |
| 3 | **Meeting point** | **No** | MEDIUM | `LISTING DATA` | Two fields invite confusion and neither works: `destinationId` is the city, `contactInfo` is the business's contact details. There is no lat/long or street address on `experiences`. Split into HOS-1048 (the field) and HOS-1049 (map + how to get there). |
| 4 | **Season / months offered** | **No** | SMALL–MEDIUM | `LISTING DATA` | |
| 5 | **Language offered** | **Stored as booleans, not shown** | SMALL | `LISTING DATA` | `english_guide_available`, `portuguese_guide_available`, `bilingual_services` already exist as catalogue rows. Coarser than a language list, but real and already filled in. |
| 6 | **Difficulty** | **Stored as booleans, not shown** | SMALL | `LISTING DATA` | `beginner_friendly`, `senior_friendly`, `pregnancy_safe`, `kid_friendly`. Same shape, same gap. |
| 7 | **What is included** | **Stored, not shown** | SMALL | `LISTING DATA` | 8 amenities seeded for this exact purpose: `transport_included`, `guide_included`, `food_included`, `equipment_included`, `insurance_included`, `hotel_pickup`, `photos_included`, `lockers_available`. |

Candidates 5, 6 and 7 are the same job: expose what is already there. Doing it
once covers all three, in both verticals, with no migration.

## Issues that measuring resolved

Three open issues are already fixed in code. Verified against the code and tests,
not against tracker state:

| Issue | Evidence |
|---|---|
| **HOS-357** — `CAN_EMBED_VIDEO` gates nothing | Commit `f58eff4e7`, whose message says so outright |
| **HOS-814** — "check the marked fields" with no field marked | `OpeningHoursSection.client.tsx:11,94` + a test citing it by number |
| **HOS-825** — add/remove shift buttons unstyled | `OpeningHoursSection.test.tsx:267` |

Still live, now with a root cause: **HOS-906** — `DayScheduleSchema` permits
`{closed: false, shifts: []}`.

## What the verdicts mean

Ten of the thirteen candidates came back the same way, and the owner wrote the
reason on each one: *"esto no es ni un entitlement ni un addon, es data básica de
la ficha, pero hay que hacer que quede andando tanto en edición como en view."*

**`LISTING DATA`** is therefore its own verdict, distinct from a tier:

> Neither an entitlement nor an addon. It is part of the listing, and the job is
> to make it work **end to end** — enterable in the owner's editor **and** rendered
> on the public page. Nothing about it is sold.

That is the answer to the finding at the top of this page. An owner who already
ticked "transport included" is not going to accept paying to make it visible, and
the platform is not going to charge for it. The whole visibility gap — cuisine
type, price range, payment methods, duration, capacity, meeting point, season,
language, difficulty, what is included — is product, not inventory.

The three that **are** sold are the three that are genuinely new features rather
than hidden data:

| Candidate | Verdict | Why it is not `LISTING DATA` |
|---|---|---|
| The menu | `TIER: pro` | A structured menu with sections, prices and photos is a whole model, not a field that exists and is hidden |
| Table booking | `TIER: premium` | A new model with states; the only thing that exists today is an `accepts_reservations` tick |
| Shifts and opening hours | `TIER: basic` | Already works, already ungated — the grant records where it belongs, it does not take it away (see the F-11 warning in Half A) |

The owner's vocabulary matters here and is worth repeating: **there is no "free"**
— publishing costs money in every vertical. What `LISTING DATA` rules out is the
opposite failure: **inventing an entitlement for every field of a listing**.

## The 21 issues this half opened

Filed 2026-09-01. Every one is `Backlog` / `kind-needs-spec` unless noted.

### Gastronomy

| Issue | What it is |
|---|---|
| HOS-1041 | Menú del día — a dish with a validity window that expires by itself |
| HOS-1042 | Recurring venue events — live music night, happy hour |
| HOS-1043 | The menu in several languages |
| HOS-1044 | Menu QR with scan metrics |
| HOS-1045 | Per-dish photos, bound to the menu items |
| HOS-1054 | Allergens and dietary fits — gluten-free, vegan, lactose-free (`LISTING DATA`) |
| HOS-1055 | Function room for events — a toggle and a "contact us" CTA |

### Experiences

| Issue | What it is |
|---|---|
| HOS-1040 | **Departures with capacity** — the equivalent of the calendar, and explicitly *not* a port of it. This is where `CAN_USE_CALENDAR` went. |
| HOS-1046 | What to bring and requirements (`LISTING DATA`) |
| HOS-1047 | Cancellation policy (`LISTING DATA`) |
| HOS-1048 | Meeting point, the field itself (`LISTING DATA`) |
| HOS-1049 | Map and how-to-get-there instructions for that meeting point |
| HOS-1050 | Booking with a deposit — charge part of it online |
| HOS-1051 | Guide profile as an addon — who takes you, their languages, their certifications |
| HOS-1052 | Experience bundles — several departures at a package price |
| HOS-1056 | Private groups — a toggle and a "contact us" CTA |
| HOS-1057 | A certificate of the experience for whoever did it |
| HOS-1060 | Private per-tourist galleries — the provider delivers the photos, Hospeda does not touch the money |

### Both verticals

| Issue | What it is |
|---|---|
| HOS-1058 | Downloadable PDF of the listing |
| HOS-1059 | Cross-recommendations between listings — "after this outing, eat here" |

### Found in passing

| Issue | What it is |
|---|---|
| HOS-1053 | `Bug` — the Contenido field's error never renders in the admin's post creation form. Unrelated to commerce; surfaced while measuring. |

## Issues this half confirmed rather than closed

Beyond the HOS-357/814/825 trio above, nothing else in this half turned out to be
already fixed. HOS-895 (the menu) and HOS-898 (duration) were both **confirmed
verbatim**, and HOS-906 stays live with its root cause now located.
