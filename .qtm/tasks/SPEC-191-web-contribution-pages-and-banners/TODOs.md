# SPEC-191: Web Contribution Pages & Banners

## Progress: 0/16 tasks (0%)

**Average Complexity:** 2.1/10 (all tasks ≤ 3)
**Critical Path:** T-001 -> T-005 -> T-008 -> T-011 -> T-014 -> T-015 -> T-016 (7 steps)
**Parallel Tracks:** 3 identified (schema/API · banner · pages)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add three contribution contact types to ContactTypeEnumSchema (additive-only)
  - Append report_destination_info, photo_submission, editor_application; additive schema test FIRST
  - Blocked by: none
  - Blocks: T-002, T-005

- [ ] **T-002** (complexity: 2) - Add Spanish CONTACT_TYPE_LABELS for the new contact types in the API handler
  - Labels in apps/api contact handler; handler test (label + audit, honeypot + 429 intact)
  - Blocked by: T-001
  - Blocks: T-015

- [ ] **T-003** (complexity: 1) - Add contribution_* event names to the WebEvents analytics catalog
  - Four snake_case event names in apps/web/src/lib/analytics/events.ts
  - Blocked by: none
  - Blocks: T-004, T-005

### Core Phase

- [ ] **T-004** (complexity: 3) - Build ContributionBanner.astro component (variants + click tracking)
  - Modeled on WhatsAppCTA; photos/editors variants; hoisted script fires contribution_banner_clicked
  - Blocked by: T-003
  - Blocks: T-011, T-012, T-013

- [ ] **T-005** (complexity: 3) - Build ContributionForm.client.tsx locked-type form island
  - Locked presetType, no select, client-side ?destino= reading, submit-success trackEvent, success copy propio
  - Blocked by: T-001, T-003
  - Blocks: T-007, T-008, T-009

- [ ] **T-006** (complexity: 2) - Create /colaborar hub landing page (SSG)
  - Hero + three cards to reportar/fotos/editores; prerender es/en/pt
  - Blocked by: none
  - Blocks: T-014

- [ ] **T-007** (complexity: 2) - Create /colaborar/reportar page (preset report_destination_info, ?destino= context)
  - SSG page mounting ContributionForm; slug read client-side by the island
  - Blocked by: T-005
  - Blocks: T-010, T-014

- [ ] **T-008** (complexity: 3) - Create /colaborar/fotos page (license terms + delivery mechanics + preset photo_submission)
  - Terms section (legal sign-off gated, D-9), delivery mechanics, accept-terms line above submit
  - Blocked by: T-005
  - Blocks: T-011, T-012, T-014

- [ ] **T-009** (complexity: 2) - Create /colaborar/editores recruitment page (preset editor_application)
  - Recruitment copy + form
  - Blocked by: T-005
  - Blocks: T-013, T-014

### Integration Phase

- [ ] **T-010** (complexity: 2) - Add destination-detail report link (sidebar row + inline link after description)
  - DestinationSidebarCtas third row + inline link, both ?destino=<slug>
  - Blocked by: T-007
  - Blocks: T-014

- [ ] **T-011** (complexity: 2) - Mount fotos banner on destination detail (after gallery)
  - variant photos, source destination_detail
  - Blocked by: T-004, T-008
  - Blocks: T-014

- [ ] **T-012** (complexity: 1) - Mount fotos banner on destinations listing (after card grid)
  - variant photos, source destination_listing; page/[page] NOT touched (redirect)
  - Blocked by: T-004, T-008
  - Blocks: T-014

- [ ] **T-013** (complexity: 2) - Mount editores banner on blog + events listings (after grid, before pagination)
  - sources blog_listing / events_listing; page/[page] rewrites NOT touched
  - Blocked by: T-004, T-009
  - Blocks: T-014

### Testing Phase

- [ ] **T-014** (complexity: 3) - Create contributions i18n namespace (es/en/pt) and consolidate all copy
  - contributions.json all keys (license terms incl.); key-presence test
  - Blocked by: T-006, T-007, T-008, T-009, T-010, T-011, T-012, T-013
  - Blocks: T-015

- [ ] **T-015** (complexity: 2) - Manual smoke es/en/pt (pages, funnels, submits, analytics) + regression fixes
  - Real submit per type, funnel links, analytics events, honeypot/429; D-9 legal gate flag
  - Blocked by: T-002, T-014
  - Blocks: T-016

### Cleanup Phase

- [ ] **T-016** (complexity: 1) - Close out SPEC-191 (quality gate, indexes, Linear, summary)
  - index-sync, Linear BETA-69/68/65, mem_session_summary
  - Blocked by: T-015
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-003, T-006
Level 1: T-002, T-004, T-005
Level 2: T-007, T-008, T-009
Level 3: T-010, T-011, T-012, T-013
Level 4: T-014
Level 5: T-015
Level 6: T-016
```

## Suggested Start

Begin with **T-001** (complexity: 2) - schema-first, no dependencies, unblocks the form island track. T-003 and T-006 can run in parallel.
