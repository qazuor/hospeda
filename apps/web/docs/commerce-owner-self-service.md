# Commerce owner self-service area (SPEC-249)

The commerce owner self-service area lets a `COMMERCE_OWNER` edit the
**operational** fields of their own gastronomy and experience listings from the
public web app, under `/[lang]/mi-cuenta/comercio`.

It is the owner-facing half of the "admin sells, owner maintains" loop: an admin
creates the listing and provisions the owner account (SPEC-239 + the
"Approve & provision" admin action, SPEC-249 Part D); the owner then keeps the
operational content fresh through this area.

## Routes

| Route | Purpose |
| --- | --- |
| `/[lang]/mi-cuenta/comercio/` | List the owner's own listings (both verticals), with a per-listing "Editar" link. |
| `/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/` | Operational editor for one listing. `vertical` is `gastronomy` or `experience`. |

Both pages are SSR (`prerender = false`) and owner-scoped. The listing list is
fetched by fanning out to the two protected `GET /{vertical}/mine` endpoints
(`fetchOwnerCommerceListings`); the editor seeds from the protected
`GET /{vertical}/{id}` detail (`fetchOwnerListingDetail`).

## What the owner CAN edit (operational fields)

Persisted through the vertical's protected `PATCH /{vertical}/{id}` endpoint
(`updateOwn`), which only accepts operational sections and gates each one with a
`COMMERCE_*_EDIT_OWN` permission:

- **Rich description** (`richDescription`)
- **Contact info** (`contactInfo`: phone, work email, website)
- **Social networks** (`socialNetworks`)
- **Opening hours** (`openingHours`, multi-shift per day)
- **Media** (`media`: featured image + gallery, uploaded via
  `POST /protected/media/upload-entity`)
- **Amenities / features** (`amenityIds` / `featureIds`)
- **Per-vertical price fields**: gastronomy → `priceRange` + `menuUrl`;
  experience → `isPriceOnRequest`

The editor PATCHes ONLY the field groups the owner actually changed (dirty
tracking), so editing one section never re-submits the rest.

## What the owner CANNOT edit (identity / core fields)

`name`, `slug`, `type`, `destinationId`, and all lifecycle/visibility/
moderation/`isFeatured`/`ownerId` fields are **read-only** for owners. They are
managed by the Hospeda team. These keys are ABSENT from the owner-update schema,
so any forged value in the PATCH body is silently stripped server-side (see the
AC-3 regression in `gastronomy.service.test.ts` / `experience.service.test.ts`).
The editor page shows identity fields read-only above the form.

## Gating

- The area lives under `/mi-cuenta/*`, so it requires an authenticated session
  and is subject to the `mustChangePassword` force-password gate: a freshly
  provisioned owner is redirected to `/mi-cuenta/cambiar-contrasena` before they
  can reach the commerce area (mechanism reused from SPEC-239).
- The page also applies a defensive UX ownership gate (non-owner / non-staff is
  bounced to `/mi-cuenta/comercio`). The hard gate is the write path:
  `updateOwn` returns `NOT_FOUND` for non-owners.

## Media replacement caveat

Gastronomy and experience do NOT merge the `media` JSONB column on update — it is
replaced wholesale. The editor therefore re-sends the complete media object and
preserves the owner-unmanaged sub-fields (`videos`, `archivedGallery`) on every
media patch. See `MediaField.tsx` + `CommerceListingEditor.client.tsx`.

## Related

- API route reference: [`apps/api/docs/route-architecture.md`](../../api/docs/route-architecture.md)
  (the `/mine` and protected `{id}` rows).
- Admin "Approve & provision" loop: `apps/admin/src/features/commerce-leads/`.
- Spec: `.qtm/specs/SPEC-249-commerce-owner-self-service-web/spec.md`.
