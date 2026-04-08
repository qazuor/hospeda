# SPEC-031: Beta Feedback Form with Linear Integration

## Progress: 46/46 tasks (100%) + 90 gap fixes applied

**Average Complexity:** 2.7/4
**Critical Path:** T-001 -> T-018 -> T-019 -> T-024 -> T-025 -> T-026 -> T-030 -> T-032 -> T-038 (9 steps)
**Parallel Tracks:** 5 tracks identified

---

### Setup Phase (12 tasks)

- [x] **T-001** (complexity: 2) - Create packages/feedback/ package scaffold
  - Initialize package with package.json, tsconfig, entry point
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005

- [x] **T-002** (complexity: 3) - Define Zod schemas for feedback form payload
  - feedbackFormSchema with all fields, types, validation constraints
  - Blocked by: T-001
  - Blocks: T-006, T-013, T-016

- [x] **T-003** (complexity: 2) - Create feedback config file with configurable settings
  - REPORT_TYPES, SEVERITY_LEVELS, LINEAR_CONFIG, FEEDBACK_CONFIG
  - Blocked by: T-001
  - Blocks: T-006, T-013, T-016, T-022

- [x] **T-004** (complexity: 1) - Create hardcoded Spanish strings constants file
  - FEEDBACK_STRINGS with all UI text in Spanish
  - Blocked by: T-001
  - Blocks: T-016, T-017, T-022, T-023, T-029

- [x] **T-005** (complexity: 2) - Add feedback environment variables to @repo/config
  - LINEAR_API_KEY, FEEDBACK_FALLBACK_EMAIL, FEEDBACK_ENABLED
  - Blocked by: T-001
  - Blocks: T-013

- [x] **T-006** (complexity: 1) - Export feedback schemas to @repo/schemas
  - Re-export feedbackFormSchema and types
  - Blocked by: T-002, T-003
  - Blocks: T-013

- [x] **T-007** (complexity: 1) - Add attachments field to SendEmailInput interface
  - Extend @repo/notifications email interface
  - Blocked by: none
  - Blocks: T-008

- [x] **T-008** (complexity: 2) - Pass attachments through ResendEmailTransport.send()
  - Forward attachments to Resend SDK
  - Blocked by: T-007
  - Blocks: T-012

- [x] **T-009** (complexity: 3) - Add skipDb and skipLogging options to NotificationService.send()
  - SendNotificationOptions interface with skipDb and skipLogging
  - Blocked by: none
  - Blocks: T-012

- [x] **T-010** (complexity: 2) - Add FEEDBACK_REPORT to NotificationType enum and template mapping
  - Enum value, category map, selectTemplate case, subject pattern
  - Blocked by: T-011
  - Blocks: T-012

- [x] **T-011** (complexity: 3) - Create FeedbackReportEmail React Email template
  - Full feedback report as HTML email using React Email
  - Blocked by: none
  - Blocks: T-010

- [x] **T-012** (complexity: 3) - Write integration tests for notifications extensions
  - Full flow test: FEEDBACK_REPORT + attachments + skipDb + skipLogging
  - Blocked by: T-008, T-009, T-010
  - Blocks: T-015

### Core Phase (19 tasks)

- [x] **T-013** (complexity: 4) - Create POST /api/v1/public/feedback endpoint with multipart validation
  - Multipart handling, Zod validation, attachment validation, honeypot
  - Blocked by: T-002, T-003, T-005, T-006
  - Blocks: T-014, T-017

- [x] **T-014** (complexity: 4) - Implement Linear API client for issue creation with file uploads
  - uploadFileToLinear (2-step: fileUpload + PUT), createLinearIssue
  - Blocked by: T-013
  - Blocks: T-015

- [x] **T-015** (complexity: 4) - Implement retry logic with exponential backoff
  - withRetry utility, 3 retries, email fallback on final failure
  - Blocked by: T-014, T-012
  - Blocks: T-017

- [x] **T-016** (complexity: 3) - Add rate limiting middleware for feedback endpoint
  - IP-based, configurable limit, in-memory store with TTL
  - Blocked by: T-002, T-003
  - Blocks: T-017

- [x] **T-017** (complexity: 4) - Write full endpoint integration tests for feedback API
  - Happy path, attachments, Linear failure, rate limiting, validation
  - Blocked by: T-015, T-016
  - Blocks: T-032

- [x] **T-018** (complexity: 3) - Build environment data collector utility
  - collectEnvironmentData with ua-parser-js, SSR handling
  - Blocked by: T-001
  - Blocks: T-019

- [x] **T-019** (complexity: 2) - Build useAutoCollect React hook
  - Auto-collect environment data on mount, mutable state
  - Blocked by: T-018
  - Blocks: T-024

- [x] **T-020** (complexity: 3) - Build useConsoleCapture hook for console.error interception
  - Circular buffer (10 entries), passive interceptor, cleanup
  - Blocked by: T-001
  - Blocks: T-019, T-024

- [x] **T-021** (complexity: 2) - Build useKeyboardShortcut hook
  - Ctrl+Shift+F / Cmd+Shift+F listener, macOS detection
  - Blocked by: T-001
  - Blocks: T-026

- [x] **T-022** (complexity: 3) - Build StepBasic component (form step 1)
  - Report type, title, description, email/name with shadcn inputs
  - Blocked by: T-003, T-004
  - Blocks: T-024

- [x] **T-023** (complexity: 4) - Build StepDetails component (form step 2)
  - Severity, reproduction steps, file upload, collapsible tech details
  - Blocked by: T-004
  - Blocks: T-024

- [x] **T-024** (complexity: 4) - Build FeedbackForm component orchestrating steps and submission
  - Multi-step state, navigation, submit, success/error states
  - Blocked by: T-019, T-020, T-022, T-023
  - Blocks: T-025

- [x] **T-025** (complexity: 3) - Build FeedbackModal component (desktop modal / mobile drawer)
  - Responsive Dialog/Drawer, focus trap, Escape close, prefillData
  - Blocked by: T-024
  - Blocks: T-026

- [x] **T-026** (complexity: 4) - Build FeedbackFAB component with minimize and pulse
  - Floating button, minimize/restore, pulse animation, keyboard shortcut
  - Blocked by: T-021, T-025
  - Blocks: T-032, T-036

- [x] **T-027** (complexity: 3) - Build useFeedbackSubmit hook for multipart API submission
  - FormData building, fetch, loading/success/error states
  - Blocked by: T-002
  - Blocks: T-024

- [x] **T-028** (complexity: 3) - Build query param serialization/deserialization for standalone
  - serializeFeedbackParams, parseFeedbackParams, XSS sanitization
  - Blocked by: T-001
  - Blocks: T-029, T-035

- [x] **T-029** (complexity: 4) - Build FeedbackErrorBoundary component
  - Error catch, friendly UI, inline modal or new tab fallback
  - Blocked by: T-004, T-025, T-028
  - Blocks: T-033, T-037

- [x] **T-030** (complexity: 1) - Update packages/feedback/src/index.ts with all public exports
  - Barrel exports for all components, hooks, config, schemas, utils
  - Blocked by: T-026, T-029
  - Blocks: T-032, T-036

- [x] **T-031** (complexity: 4) - Write component integration tests for feedback form flow
  - Full FAB -> modal -> form -> submit flow tests
  - Blocked by: T-026, T-029
  - Blocks: T-032

### Integration Phase (7 tasks)

- [x] **T-032** (complexity: 2) - Integrate FeedbackFAB in apps/web BaseLayout as React island
  - React island with client:idle, pass appSource and auth context
  - Blocked by: T-017, T-030, T-031
  - Blocks: T-038

- [x] **T-033** (complexity: 3) - Integrate FeedbackErrorBoundary in apps/web React islands
  - Wrap key React islands with error boundary
  - Blocked by: T-029
  - Blocks: T-038

- [x] **T-034** (complexity: 1) - Update apps/web 500.astro with link to standalone feedback form
  - Plain HTML link to /es/feedback with query params
  - Blocked by: none
  - Blocks: T-038

- [x] **T-035** (complexity: 3) - Create standalone feedback page at /[lang]/feedback.astro
  - Minimal layout, client:load, query param pre-fill, mailto fallback
  - Blocked by: T-028, T-030
  - Blocks: T-038

- [x] **T-036** (complexity: 2) - Integrate FeedbackFAB in apps/admin root layout
  - Add to TanStack Start root layout with auth context
  - Blocked by: T-026, T-030
  - Blocks: T-038

- [x] **T-037** (complexity: 2) - Integrate FeedbackErrorBoundary in apps/admin router
  - Wrap router outlet with error boundary
  - Blocked by: T-029
  - Blocks: T-038

- [x] **T-038** (complexity: 4) - Write integration tests for app-level feedback integration
  - Web FAB, admin FAB, standalone page, 500 page, error boundaries
  - Blocked by: T-032, T-033, T-034, T-035, T-036, T-037
  - Blocks: T-039

### Testing Phase (7 tasks)

- [x] **T-039** (complexity: 3) - Responsive testing: modal on desktop, drawer on mobile
  - E2E tests at multiple breakpoints
  - Blocked by: T-038
  - Blocks: none

- [x] **T-040** (complexity: 4) - Accessibility audit: keyboard nav, focus management, screen reader
  - Focus trap, ARIA attributes, axe-core audit
  - Blocked by: T-038
  - Blocks: none

- [x] **T-041** (complexity: 2) - FAB minimize/restore testing with localStorage persistence
  - Minimize behavior, hover expand, persistence across pages
  - Blocked by: T-038
  - Blocks: none

- [x] **T-042** (complexity: 2) - Rate limiting E2E verification
  - 30 requests pass, 31st returns 429, independent IPs
  - Blocked by: T-038
  - Blocks: none

- [x] **T-043** (complexity: 4) - Linear integration E2E test with mock server
  - Full flow: submit -> fileUpload -> PUT -> issueCreate
  - Blocked by: T-038
  - Blocks: none

- [x] **T-044** (complexity: 3) - Error boundary E2E test: simulate crash and verify form opens pre-filled
  - Playwright: crash -> error UI -> report button -> form pre-filled
  - Blocked by: T-038
  - Blocks: none

- [x] **T-045** (complexity: 2) - Keyboard shortcut E2E test
  - Ctrl+Shift+F opens/closes, Escape closes, works minimized
  - Blocked by: T-038
  - Blocks: none

### Cleanup Phase (1 task)

- [x] **T-046** (complexity: 2) - Update Linear config with real IDs (manual step)
  - Replace all PLACEHOLDER_ values, set env vars, test real submission
  - Blocked by: T-038
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-007, T-009, T-011, T-034
Level 1: T-002, T-003, T-004, T-005, T-008, T-018, T-020, T-021, T-028
Level 2: T-006, T-010, T-016, T-019, T-022, T-023, T-027
Level 3: T-012, T-013, T-024
Level 4: T-014, T-025
Level 5: T-015, T-026, T-029
Level 6: T-017, T-030, T-031
Level 7: T-032, T-033, T-035, T-036, T-037
Level 8: T-038
Level 9: T-039, T-040, T-041, T-042, T-043, T-044, T-045, T-046

## Parallel Tracks

1. **Feedback package** (T-001 -> T-002/T-003/T-004 -> T-022/T-023 -> T-024 -> T-025 -> T-026)
2. **Notifications extensions** (T-007 -> T-008 -> T-012) + (T-009 -> T-012) + (T-011 -> T-010 -> T-012)
3. **API endpoint** (T-013 -> T-014 -> T-015 -> T-017)
4. **Hooks & utilities** (T-018 -> T-019, T-020, T-021, T-028)
5. **Error boundary** (T-029 -> T-033, T-037)

## Suggested Start

Begin with **T-001** (complexity: 2) - Create packages/feedback/ package scaffold.
It has no dependencies and unblocks 4 other tasks (T-002, T-003, T-004, T-005).

In parallel, start **T-007** (complexity: 1), **T-009** (complexity: 3), **T-011** (complexity: 3), and **T-034** (complexity: 1) - they have no dependencies either.
