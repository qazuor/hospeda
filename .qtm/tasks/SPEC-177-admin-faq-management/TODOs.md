# TODOs: Admin FAQ Management UI (Phase 2 of SPEC-158)

Spec: SPEC-177 | Status: draft | Progress: 0/32

## Setup
- [ ] T-001: Add display_order column to destination_faqs + accommodation_faqs dbschemas (complexity: 2)
- [ ] T-002: Generate Drizzle migration + backfill display_order by created_at (complexity: 5) [blocked by T-001]
- [ ] T-003: Add displayOrder to BaseFaqSchema, additive (complexity: 2)
- [ ] T-004: Add FaqReorderPayloadSchema + per-entity reorder input schemas (complexity: 3) [blocked by T-003]
- [ ] T-005: Export FAQ_BASELINE_CATEGORIES constant (complexity: 1)

## Core
- [ ] T-006: destination.service updateFaq (complexity: 3) [blocked by T-003]
- [ ] T-007: destination.service removeFaq (complexity: 3)
- [ ] T-008: destination.service adminGetFaqs (complexity: 3)
- [ ] T-009: destination.service reorderFaqs (complexity: 5) [blocked by T-004]
- [ ] T-010: accommodation.service reorderFaqs (complexity: 4) [blocked by T-004]
- [ ] T-011: addFaq assigns display_order = max+1, both services (complexity: 3) [blocked by T-001]
- [ ] T-012: Read order display_order ASC NULLS LAST in faq reads, both (complexity: 4) [blocked by T-001]

## Integration
- [ ] T-013: API destination/admin getFaqs route (complexity: 2) [blocked by T-008]
- [ ] T-014: API destination/admin addFaq route (complexity: 2)
- [ ] T-015: API destination/admin updateFaq route (complexity: 2) [blocked by T-006]
- [ ] T-016: API destination/admin removeFaq route (complexity: 2) [blocked by T-007]
- [ ] T-017: API reorderFaqs route, destination + accommodation (complexity: 3) [blocked by T-009, T-010]
- [ ] T-018: API register new FAQ routes in both admin index.ts (complexity: 2) [blocked by T-013..T-017]
- [ ] T-019: Admin generic FaqManager + SortableFaqRow (complexity: 6)
- [ ] T-020: Admin useFaqs TanStack Query hook (complexity: 4)
- [ ] T-021: Admin category combobox baseline + free (complexity: 3) [blocked by T-005]
- [ ] T-022: Admin drag-to-reorder wiring (complexity: 5) [blocked by T-019, T-020]
- [ ] T-023: Admin add FAQs tab to both tab arrays (complexity: 2) [blocked by T-019]
- [ ] T-024: Admin $id_.faqs.tsx routes both entities (complexity: 3) [blocked by T-019, T-023]
- [ ] T-025: Admin i18n keys es/en/pt (complexity: 2) [blocked by T-019]

## Testing
- [ ] T-026: Service tests destination CRUD (complexity: 4) [blocked by T-006, T-007, T-008]
- [ ] T-027: Service tests reorder both + addFaq order + ownership (complexity: 4) [blocked by T-009, T-010, T-011, T-002]
- [ ] T-028: API integration tests destination routes + reorder both (complexity: 5) [blocked by T-018]
- [ ] T-029: Admin FaqManager component tests (complexity: 4) [blocked by T-021, T-022, T-024]
- [ ] T-030: Public detail respects display_order test (complexity: 3) [blocked by T-012]

## Docs
- [ ] T-031: Document admin FAQ management (complexity: 2) [blocked by T-024]

## Cleanup
- [ ] T-032: Full verification + close spec (complexity: 4) [blocked by T-026..T-031]
