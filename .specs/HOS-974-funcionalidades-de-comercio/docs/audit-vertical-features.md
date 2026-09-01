# Half B · Vertical-specific features — measurement complete, decisions pending

**Measured** 2026-09-01 against `origin/staging`. Measurement columns are
**MEASURED** with file:line evidence; the decision column is **empty on purpose**.

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

| # | Candidate | Exists today | Cost | Notes |
|---|---|---|---|---|
| 1 | **The menu** | Partially — one text input requiring an `https` URL | MEDIUM–LARGE | HOS-895 confirmed verbatim: no photo, no PDF, no structured model with sections and prices. A real menu is a whole feature — and it is what people actually look for in a restaurant. |
| 2 | **Shifts and opening hours** | Yes, and healthier than reported | SMALL | Of the three issues cited, **HOS-814 and HOS-825 are already fixed** (tests cite them by number). **HOS-906 is still live**, with a located root cause: `DayScheduleSchema` accepts `{closed: false, shifts: []}` with no cross-field refine, so a day can be neither open nor closed. A `.superRefine` closes it. |
| 3 | **Table booking** | No booking flow | LARGE | Only an `accepts_reservations` tick in the shared catalogue — and even that is not shown to visitors today (see the finding above). Real booking means a new model with states. |
| 4 | **Cuisine type** | **No** | SMALL–MEDIUM | Confirmed with two search conventions. `type` is the venue category (9 values: RESTAURANT/BAR/CAFE/PARRILLA/…), not a culinary style. Could be catalogue rows rather than a column. |
| 5 | **Price range** | **Complete end to end** | — | `priceRange`, 4 tiers, the only candidate with no gaps anywhere in the chain. No separate numeric cover charge exists. |
| 6 | **Payment methods / delivery / takeaway** | Stored, not shown | SMALL | `accepts_cards`, `delivery`, `takeaway` already exist as catalogue rows. `accepts_cards` is a single generic boolean, not granular per method. Same visibility gap. |

## Experiences

The six scalar fields are genuinely absent — confirmed with two naming
conventions each, plus a negative control (`priceFrom` does appear, so the search
technique works). But "absent" splits in two, and the split is the point.

| # | Candidate | Exists today | Cost | Notes |
|---|---|---|---|---|
| 1 | **Duration** | **No** — not in the form, not in the database | SMALL | HOS-898. Probably the single most-asked fact about an excursion, and it cannot be entered. |
| 2 | **Capacity per departure** | **No** | SMALL–MEDIUM | Depends on whether it is informational or enforced against bookings. |
| 3 | **Meeting point** | **No** | MEDIUM | Two fields invite confusion and neither works: `destinationId` is the city, `contactInfo` is the business's contact details. There is no lat/long or street address on `experiences`. |
| 4 | **Season / months offered** | **No** | SMALL–MEDIUM | |
| 5 | **Language offered** | **Stored as booleans, not shown** | SMALL | `english_guide_available`, `portuguese_guide_available`, `bilingual_services` already exist as catalogue rows. Coarser than a language list, but real and already filled in. |
| 6 | **Difficulty** | **Stored as booleans, not shown** | SMALL | `beginner_friendly`, `senior_friendly`, `pregnancy_safe`, `kid_friendly`. Same shape, same gap. |
| 7 | **What is included** | **Stored, not shown** | SMALL | 8 amenities seeded for this exact purpose: `transport_included`, `guide_included`, `food_included`, `equipment_included`, `insurance_included`, `hotel_pickup`, `photos_included`, `lockers_available`. |

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

## How to fill the decision column

Per candidate, per vertical:

- **`TIER: basic` / `pro` / `premium`** — which tier grants it.
- **`ADDON`** — sold separately (feeds HOS-977).
- **`FREE FOR ALL`** — part of the product, not sold. The right answer for anything
  already stored and merely hidden: an owner who already typed it in is not going
  to accept paying to make it visible.
- **`DOES NOT APPLY`** — with the reason written down.
- **`LATER`** — worth building, not now.

Start with the visibility gap. It is the cheapest thing on this page and the only
one where the owner has already done their part.
