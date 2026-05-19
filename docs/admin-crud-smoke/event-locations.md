# CRUD smoke — event-locations (D-4)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-evtloc
- **Outcome**: 🔴 **FAIL at step 2 — backend rejects with VALIDATION_ERROR for missing field that has no UI control**

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 6 rows visible. |
| 2 | Create | 🔴 | POST returned 400 VALIDATION_ERROR: missing `destinationId`. The field is **NOT EXPOSED** on the new form. |
| 3-9 | … | ⏭ N/A | Blocked by step 2 |

## Findings

### D-4.1 🔴 CRITICAL — `event-locations` create form does not collect required `destinationId`

POST `/api/v1/admin/event-locations` rejects the submission with:

```json
{
  "code": "VALIDATION_ERROR",
  "details": [{
    "field": "destinationId",
    "messageKey": "zodError.common.id.required",
    "userFriendlyMessage": "Destination id must be text (received unknown)"
  }]
}
```

The `/events/locations/new` form has 12 fields visible (placeName, slug, street, number, floor,
apartment, neighborhood, city, department, country, latitude, longitude) plus the lifecycle
combobox — **none of them is `destinationId`**. Yet the backend declares it required.

- **Suspected root cause**: schema/UI drift. Either the schema was tightened (added required
  `destinationId`) without updating the form config, or the form is missing a `DestinationSelect`
  dropdown that should pre-load the user's destinations and bind to the field.
- **Fix direction**: add a `<DestinationSelect>` field to the event-locations form config (likely
  in `apps/admin/src/features/event-locations/config/sections/...`). Use the existing
  `DestinationSelect` component from `apps/admin/src/components/selects/`.
- **Acceptance**: form shows a Destino dropdown with the user's destinations; submission succeeds.

### D-4.2 (NEW finding D-9.2-style toast issue, confirmed) — Error toast title-equals-body

"Error al crear Ubicación: Error al crear Ubicación" — same template/data duplication. Pattern.

### D-4.3 (related to I-1, confirmed) — `Nuevo {entity} Ubicación` placeholder leak

### D-4.4 — Inconsistent address modeling between `event-locations` and `destinations`

`/events/locations/new` uses **flat** field ids: `field-street`, `field-city`, `field-country`.
`/destinations/new` uses **nested** field ids: `field-location.street`, `field-location.city`,
`field-location.country`. Both forms model "address" data but with different id schemes. Pick
one convention and apply it to both — affects the dot-notation form bug (D-2.1) which only
applies to the destinations side.

## Console errors during this smoke

`Failed to load resource: 400` once on submit. No JS exceptions.
