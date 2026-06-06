# TODOs: Destination Review Submission Flow (web) + API contract/security fix

Spec: SPEC-202 | Status: in-progress | Progress: 18/18

## Setup

- [x] T-001: Add unique index (user_id, destination_id) to destination_review dbschema (complexity: 2)
- [x] T-002: Generate migration and hand-edit dedup DELETE before unique index (complexity: 3) [blocked by T-001]
- [x] T-003: Add DestinationReviewCreateBodySchema to @repo/schemas (complexity: 2)
- [x] T-004: Add 18 destination.rating.dimensions.* i18n keys (es/en/pt) (complexity: 2)
- [x] T-005: Add destination review form/sidebar i18n keys (es/en/pt) (complexity: 2)

## Core

- [x] T-006: Service duplicate pre-check in DestinationReviewService._beforeCreate (complexity: 3)
- [x] T-007: Route security fix: body schema + userId from actor (complexity: 3) [blocked by T-003]

## Integration

- [x] T-008: Add destinationReviewsApi.create() to web endpoints-protected (complexity: 2)
- [x] T-009: Create DestinationReviewSidebarCard.client.tsx + module.css (complexity: 6) [blocked by T-004, T-005, T-008]
- [x] T-010: Create DestinationReviewSignInCta.astro (logged-out CTA) (complexity: 2) [blocked by T-005]
- [x] T-011: Mount review card / sign-in CTA in destination page sidebar (complexity: 2) [blocked by T-009, T-010]

## Testing

- [x] T-012: Schema tests for DestinationReviewCreateBodySchema (complexity: 2) [blocked by T-003]
- [x] T-013: Service tests for duplicate guard (complexity: 3) [blocked by T-006]
- [x] T-014: API route security tests (anti-impersonation regression + 409 + gates) (complexity: 4) [blocked by T-006, T-007]
- [x] T-015: Fix legacy integration smoke test (wrong tier + userId in body) (complexity: 2) [blocked by T-007]
- [x] T-016: Web component tests for DestinationReviewSidebarCard (complexity: 4) [blocked by T-009]

## Docs

- [x] T-017: Verify endpoint-gate-matrix row for destination review create (complexity: 1) [blocked by T-007]
- [x] T-018: Local e2e verification (manual smoke) (complexity: 3) [blocked by T-002, T-011, T-014]
