# HOS-2059 inventory: production link counts

Read-only snapshot of production, taken 2026-11-06 through `hops --target=prod psql`
(no writes). It covers every catalog row that data-migration
`0147-hos-2059-catalog-curation` retires, renames or retypes, and the survivor
each retired row is merged into.

## Totals

| Measure | Value |
|---|---|
| Amenity rows (live and deleted) | 110 |
| Feature rows (live and deleted) | 106 |
| `r_accommodation_amenity` rows | 122 |
| `r_accommodation_feature` rows | 41 |
| Venue and experience links on any touched row | 0 |
| Slugs present in both catalogs | 2 (`laundry_service`, `luggage_storage`) |

Production does **not** have the HOS-2058 columns yet (`r_accommodation_amenity.scope`
and `availability`, `features.category`). 0147 declares
`requiresColumns: r_accommodation_amenity.scope`, so its runner refuses to apply
it to production until HOS-2058's schema migration has been applied there.

## Retired rows and their survivors

Counts are accommodation links (`acc`). Venue and experience counts were zero on
every row listed.

| Retired row | acc | Survivor | Survivor acc | Absorbed attribute |
|---|---|---|---|---|
| amenity `river_view` | 1 | feature `river_view` (new) | 0 | (none, cross-kind) |
| amenity `river_access` | 0 | feature `river_access` (new) | 0 | (none, cross-kind) |
| amenity `panoramic_view` | 1 | feature `panoramic_view_extended` | 1 | (none, cross-kind) |
| amenity `shared_kitchen` | 0 | amenity `full_kitchen` | 4 | `scope = shared` |
| amenity `shared_patio` | 2 | amenity `patio` | 3 | `scope = shared` |
| amenity `umbrella_gazebo` | 0 | amenity `gazebo` (new) | 0 | (none) |
| feature `laundry_service` | 0 | amenity `laundry_service` | 0 | (none, cross-kind) |
| feature `luggage_storage` | 0 | amenity `luggage_storage` | 0 | (none, cross-kind) |
| feature `wifi_full_property` | 0 | amenity `wifi` | 4 | (none, cross-kind) |
| feature `satellite_wifi` | 0 | amenity `wifi` | 4 | (none, cross-kind) |
| feature `internal_parking` | 0 | amenity `parking` | 3 | (none, cross-kind) |
| feature `perimeter_lighting` | 0 | amenity `outdoor_lighting` | 2 | (none, cross-kind) |
| feature `disability_accessible` | 1 | amenity `wheelchair_accessible` | 0 | (none, cross-kind) |
| feature `remote_coworking_suitable` | 0 | amenity `coworking_space` | 0 | (none, cross-kind) |
| feature `camping_sector` | 0 | feature `camping_area` | 0 | (none) |
| feature `private_grill` | 0 | amenity `bbq_grill` | 4 | `scope = private` |
| feature `covered_barbecue_area` | 0 | amenity `quincho` | 3 | (none, cross-kind) |
| feature `transfer_service` | 0 | amenity `transfer_service` (new) | 0 | (none, cross-kind) |
| feature `vehicle_rental` | 0 | amenity `vehicle_rental` (new) | 0 | (none, cross-kind) |

**5 relation rows** sit on retired catalog rows in production (river_view 1,
panoramic_view 1, shared_patio 2, disability_accessible 1). 0147 moves each onto
its survivor, or collapses it when the same listing already links the survivor.
Expected after 0147: zero relation rows on a retired catalog row, and
`moved + collapsed = 5` in its log line.

## Retyped amenities

| Amenity | acc | Type now | Type after |
|---|---|---|---|
| `hair_dryer` | 2 | CLIMATE_CONTROL | BED_AND_BATH |
| `tv_per_room` | 2 | CONNECTIVITY | ENTERTAINMENT |
| `smart_tv` | 3 | CONNECTIVITY | ENTERTAINMENT |
| `cable_tv` | 4 | CONNECTIVITY | ENTERTAINMENT |
| `fireplace` | 0 | OUTDOORS | CLIMATE_CONTROL |
| `blackout_curtains` | 2 | BED_AND_BATH | GENERAL_APPLIANCES |
| `bicycles` | 0 | GENERAL_APPLIANCES | ENTERTAINMENT |
| `outdoor_lighting` | 2 | GENERAL_APPLIANCES | OUTDOORS |

Every "type now" value matches the `from` guard in `AMENITY_RETYPES`, so none of
the eight retypes is skipped in production.

## Renamed feature

`spa_front` becomes `balneario_front`: 0 accommodation links. The row keeps its
id, so no relation moves.
