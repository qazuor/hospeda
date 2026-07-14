# HOS-145: "What's Nearby" POI Section on Accommodation Detail

## Progress: 0/11 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-002 -> T-003 -> T-004 -> T-005 -> T-006 -> T-009 -> T-011 (7 steps)
**Parallel Tracks:** 3 identified (backend chain, web-presentational chain, schema/i18n leaves)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add NearbyPoi + query-params Zod schemas
  - NearbyPoiSchema (PointOfInterestPublic + distanceKm) + NearbyPoiQuerySchema (radius/limit bounds)
  - Blocked by: none
  - Blocks: T-003, T-005, T-008

### Core Phase

- [ ] **T-002** (complexity: 3) - PointOfInterestModel.findWithinRadius (geo.ts wiring)
  - Haversine within-radius + distance-order against POI doublePrecision lat/long; null/inactive guards
  - Blocked by: none
  - Blocks: T-003

- [ ] **T-003** (complexity: 2) - PointOfInterestService.getNearby
  - Generic service wrapper (reusable by HOS-146/147), projects to NearbyPoi
  - Blocked by: T-001, T-002
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) - AccommodationService.getNearbyPois (reads real coords)
  - Reads raw coords pre-projection; no-coords -> []; never leaks accommodation coordinate (AC-4/AC-5)
  - Blocked by: T-003
  - Blocks: T-005

### Integration Phase

- [ ] **T-005** (complexity: 3) - Public API route GET /accommodations/:slug/nearby-pois
  - createPublicRoute + query validation; integration test incl AC-4 privacy assertion
  - Blocked by: T-001, T-004
  - Blocks: T-006, T-011

- [ ] **T-006** (complexity: 1) - Web API client accommodationsApi.getNearbyPois
  - Blocked by: T-005
  - Blocks: T-009

- [ ] **T-007** (complexity: 1) - i18n keys for the nearby-POI section
  - accommodations.detail.nearbyPoi.title (es/en/pt); reuse poiTypeLabels
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-008** (complexity: 3) - WhatsNearbySection.astro presentational component
  - Mirror DestinationPOISection + distance-format util; empty -> render nothing
  - Blocked by: T-001, T-007
  - Blocks: T-009, T-010

- [ ] **T-009** (complexity: 2) - Wire SSR fetch + section into accommodation detail page
  - Soft-fail fetch; insert after <LocationSection /> (~line 578)
  - Blocked by: T-006, T-008
  - Blocks: T-011

### Testing Phase

- [ ] **T-010** (complexity: 2) - Component render tests (ordering + empty + distance)
  - Blocked by: T-008
  - Blocks: none

- [ ] **T-011** (complexity: 2) - End-to-end acceptance verification (AC-1..AC-6)
  - Blocked by: T-009
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-007
Level 1: T-003, T-008
Level 2: T-004, T-010
Level 3: T-005
Level 4: T-006
Level 5: T-009
Level 6: T-011

## Suggested Start

Begin with **T-001** (schemas, complexity 2) or **T-002** (DB geo model, complexity 3) in parallel — both are dependency-free roots. T-002 is on the critical path, so start there if working single-track. **T-007** (i18n) is a trivial leaf that can be knocked out anytime to unblock the web-presentational track (T-008).
