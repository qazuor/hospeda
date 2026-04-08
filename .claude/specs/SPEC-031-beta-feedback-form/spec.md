---
spec-id: SPEC-031
title: "Beta Feedback Form with Linear Integration"
type: feature
complexity: high
status: in-progress
created: 2026-03-06T00:00:00.000Z
approved: 2026-03-06T00:00:00.000Z
---

# SPEC-031: Beta Feedback Form with Linear Integration

## Part 1 .. Functional Specification

### 1. Overview & Goals

#### Goal

Build a unified bug report and feedback system for beta testing. The form is available as a floating button (FAB) in both `apps/web` and `apps/admin`, as a standalone page, and as an error boundary fallback. Reports are sent to Linear via API with automatic environment data capture. All configuration (categories, labels, priorities) lives in a single config file for easy synchronization with Linear.

#### Motivation

The platform is entering beta testing. Testers need a structured, low-friction way to report bugs (JS errors, UI/UX issues, content errors) and request features. Reports must flow directly into Linear for tracking. The form must remain accessible even when an app crashes .. if a page explodes, the error boundary should still let the user report the problem.

#### Success Metrics

- Form accessible from FAB in web and admin apps
- Form accessible via keyboard shortcut (`Ctrl+Shift+F` / `Cmd+Shift+F`)
- Form accessible as standalone page at `/feedback` (minimal layout, crash-resistant)
- Error boundaries in both apps show "Report this error" button that opens the form pre-filled with error data
- Reports create Linear issues with correct labels, priority, and auto-collected metadata
- File attachments uploaded directly to Linear (no separate storage needed)
- All auto-collected data is visible and editable by the user before submission
- Form works without authentication (email + name required if not logged in)
- All user-facing text hardcoded in Spanish (no i18n dependency)
- All styles hardcoded, aligned with admin panel light mode (no theming dependency)
- Config file for categories, labels, priorities, severities is easy to edit and sync with Linear
- All configuration (Linear mapping, fallback email, rate limit) is centralized and easy to change

#### Target Users

- Beta testers (internal team, early access users)
- Property owners testing the admin panel
- Public web users encountering issues

#### Non-Goals

- Admin dashboard to manage/triage feedback (use Linear directly)
- Email notifications from Linear side (configured directly in Linear)
- Duplicate detection or spam filtering (low volume during beta)
- Analytics or feedback aggregation
- i18n / multi-language support (hardcoded Spanish only for beta)
- Dark mode / theming (hardcoded light mode styles)
- Linear webhook for syncing issue status back (future enhancement)

---

### 2. User Stories & Acceptance Criteria

#### US-01: User reports a bug via floating button

**As a** beta tester using the web or admin app
**I want** to click a floating button to open a bug report form
**So that** I can quickly report issues without leaving the page

**Acceptance Criteria:**

- **Given** the user is on any page in web or admin
- **When** they click the floating feedback button (FAB)
- **Then** a modal/drawer opens with the feedback form
- **And** the form auto-captures: current URL, browser, OS, viewport, timestamp, app source, deploy version
- **And** if the user is logged in, email and name are pre-filled
- **And** the user can edit all auto-captured data
- **And** the FAB is positioned bottom-right, above any other floating elements
- **And** the FAB has a tooltip "Reportar un problema"
- **And** the form can also be opened via keyboard shortcut `Ctrl+Shift+F` (or `Cmd+Shift+F` on macOS)

#### US-02: User submits a quick report (Step 1 only)

**As a** beta tester who found a minor issue
**I want** to submit a report with just the basics
**So that** I don't waste time filling optional fields

**Acceptance Criteria:**

- **Given** the user opened the feedback form
- **When** they fill in: report type, title, and description
- **Then** a "Submit" button is available immediately (no need to go to step 2)
- **And** the report is created in Linear with the auto-collected metadata
- **And** a success confirmation is shown with the Linear issue identifier

#### US-03: User submits a detailed report (Step 1 + Step 2)

**As a** beta tester who found a complex bug
**I want** to provide reproduction steps, severity, and screenshots
**So that** the dev team can fix the issue faster

**Acceptance Criteria:**

- **Given** the user completed step 1
- **When** they click "Add more details" (or similar)
- **Then** step 2 shows: severity, steps to reproduce, expected result, actual result, screenshot upload
- **And** all step 2 fields are optional
- **And** the user can go back to step 1 to edit
- **And** on submit, all data (step 1 + step 2 + auto-captured) is sent

#### US-04: User reports a crash via error boundary

**As a** user who encountered a page crash
**I want** to report the error even though the app is broken
**So that** the dev team knows about the crash

**Acceptance Criteria:**

- **Given** a React component or Astro page throws an unhandled error
- **When** the error boundary catches it
- **Then** a friendly error message is shown with a "Report this error" button
- **And** clicking the button either:
  - Opens the feedback form inline (if the widget JS is still functional)
  - Opens a new tab to the standalone form URL with error data passed via query params
- **And** the form is pre-filled with: error message, stack trace (truncated), URL where it happened, report type set to "Bug JS"
- **And** the user can edit all pre-filled data before submitting

#### US-05: User uses standalone form

**As a** beta tester who received a direct link to the feedback form
**I want** to access the form without needing the main app
**So that** I can report issues even if the app is down

**Acceptance Criteria:**

- **Given** the user navigates to `/[lang]/feedback`
- **When** the page loads
- **Then** the form is displayed in a minimal layout (no heavy dependencies)
- **And** the form accepts query params to pre-fill fields (`type`, `title`, `description`, `url`, `error`, `source`)
- **And** email and name are required (no auth context)
- **And** the page works independently of the main app's health

#### US-06: Unauthenticated user provides contact info

**As a** user who is not logged in
**I want** to provide my email and name
**So that** the dev team can follow up on my report

**Acceptance Criteria:**

- **Given** the user is not authenticated
- **When** the form loads
- **Then** email and name fields are shown and marked as required
- **And** validation ensures valid email format
- **And** the data is included in the Linear issue body

#### US-07: User reviews auto-collected data

**As a** privacy-conscious beta tester
**I want** to see and edit all automatically collected data
**So that** I know exactly what is being sent

**Acceptance Criteria:**

- **Given** the form has auto-collected environment data
- **When** the user expands "Technical details" (collapsible section in step 2)
- **Then** all auto-collected fields are shown with their values
- **And** each field is editable
- **And** the user can clear any field they don't want to send

#### US-08: User opens form via keyboard shortcut

**As a** power user or developer testing the app
**I want** to open the feedback form with a keyboard shortcut
**So that** I can report issues without reaching for the mouse

**Acceptance Criteria:**

- **Given** the user is on any page in web or admin
- **When** they press `Ctrl+Shift+F` (or `Cmd+Shift+F` on macOS)
- **Then** the feedback form modal opens (same as clicking the FAB)
- **And** pressing the shortcut again or `Escape` closes it
- **And** the shortcut does not conflict with browser defaults

#### US-09: User minimizes the FAB

**As a** beta tester who finds the floating button distracting
**I want** to minimize it to a smaller, less intrusive indicator
**So that** it doesn't block content while I'm working

**Acceptance Criteria:**

- **Given** the FAB is visible in its full size
- **When** the user clicks a minimize/collapse control on the FAB
- **Then** the FAB shrinks to a small dot/pill (e.g., 24px)
- **And** hovering over the minimized FAB expands it back temporarily
- **And** clicking the minimized FAB opens the form
- **And** the minimized state persists via `localStorage` across page navigations
- **And** a tooltip on the minimized FAB says "Reportar un problema"

---

### 3. Data Model & Configuration

#### 3.1 Report Types (Categories)

Defined in a config file (`packages/feedback/src/config/feedback.config.ts`).
All labels are hardcoded in Spanish (no i18n dependency):

```typescript
export const REPORT_TYPES = [
  { id: "bug-js", label: "Error de JavaScript", linearLabelId: "PLACEHOLDER_LABEL_BUG_JS" },
  { id: "bug-ui-ux", label: "Error de UI/UX", linearLabelId: "PLACEHOLDER_LABEL_BUG_UI_UX" },
  { id: "bug-content", label: "Error de texto/imagen", linearLabelId: "PLACEHOLDER_LABEL_BUG_CONTENT" },
  { id: "feature-request", label: "Solicitud de funcionalidad", linearLabelId: "PLACEHOLDER_LABEL_FEATURE_REQUEST" },
  { id: "improvement", label: "Mejora", linearLabelId: "PLACEHOLDER_LABEL_IMPROVEMENT" },
  { id: "other", label: "Otro", linearLabelId: "PLACEHOLDER_LABEL_OTHER" },
] as const;
```

#### 3.2 Severity Levels

```typescript
export const SEVERITY_LEVELS = [
  { id: "critical", label: "Critico", description: "La app no funciona / datos perdidos", linearPriority: 1 },
  { id: "high", label: "Alto", description: "Funcionalidad principal rota", linearPriority: 2 },
  { id: "medium", label: "Medio", description: "Funciona pero con problemas", linearPriority: 3 },
  { id: "low", label: "Bajo", description: "Detalle menor / cosmetico", linearPriority: 4 },
] as const;
```

#### 3.3 Linear Configuration

```typescript
export const LINEAR_CONFIG = {
  teamId: "PLACEHOLDER_TEAM_ID",
  projectId: "PLACEHOLDER_PROJECT_ID",
  defaultStateId: "PLACEHOLDER_STATE_TRIAGE",
  labels: {
    source: {
      web: "PLACEHOLDER_LABEL_SOURCE_WEB",
      admin: "PLACEHOLDER_LABEL_SOURCE_ADMIN",
      standalone: "PLACEHOLDER_LABEL_SOURCE_STANDALONE",
    },
    environment: {
      beta: "PLACEHOLDER_LABEL_ENV_BETA",
    },
  },
} as const;
```

#### 3.4 Configurable Settings

All configurable values centralized in `feedback.config.ts`:

```typescript
export const FEEDBACK_CONFIG = {
  /** Linear field mapping (IDs to sync manually with Linear) */
  linear: LINEAR_CONFIG,

  /** Report types with Linear label mapping */
  reportTypes: REPORT_TYPES,

  /** Severity levels with Linear priority mapping */
  severityLevels: SEVERITY_LEVELS,

  /** Fallback email when Linear API fails after retries */
  fallbackEmail: "feedback@hospeda.com",

  /** Rate limit: max reports per IP per hour */
  rateLimit: 30,

  /** Max retries to Linear API before falling back to email */
  linearMaxRetries: 3,

  /** Max file size for attachments in bytes (10MB) */
  maxFileSize: 10_485_760,

  /** Max number of attachments per report */
  maxAttachments: 5,

  /** Keyboard shortcut to open the form */
  keyboardShortcut: { key: "f", ctrl: true, shift: true },

  /** Kill switch */
  enabled: true,
} as const;
```

#### 3.5 Auto-Collected Data

| Field | Source | Editable | Notes |
|-------|--------|----------|-------|
| `currentUrl` | `window.location.href` | Yes | URL where FAB was clicked or error occurred |
| `browser` | Parsed from `navigator.userAgent` | Yes | e.g. "Chrome 120" |
| `os` | Parsed from `navigator.userAgent` | Yes | e.g. "Windows 11" |
| `viewport` | `window.innerWidth x window.innerHeight` | Yes | e.g. "1920x1080" |
| `timestamp` | `new Date().toISOString()` | No | When the form was opened |
| `appSource` | Config constant per app | No | "web", "admin", or "standalone" |
| `deployVersion` | Build-time env var | Yes | Git commit hash or release tag |
| `userId` | Auth session (if available) | No | Internal user ID |
| `userEmail` | Auth session or manual input | Yes | Pre-filled if logged in |
| `userName` | Auth session or manual input | Yes | Pre-filled if logged in |
| `consoleErrors` | Captured from `console.error` buffer | Yes | Last 10 console errors (truncated) |
| `errorInfo` | Error boundary catch | Yes | Error message + stack trace (if crash) |

#### 3.6 Form Payload Schema (Zod)

```typescript
export const feedbackFormSchema = z.object({
  // Step 1 (required)
  type: z.enum(["bug-js", "bug-ui-ux", "bug-content", "feature-request", "improvement", "other"]),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),

  // Step 2 (optional)
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  stepsToReproduce: z.string().max(3000).optional(),
  expectedResult: z.string().max(1000).optional(),
  actualResult: z.string().max(1000).optional(),
  attachments: z.array(z.instanceof(File)).max(5).optional(), // Files uploaded directly to Linear

  // User info (required if not authenticated)
  reporterEmail: z.string().email(),
  reporterName: z.string().min(2).max(100),

  // Auto-collected (all editable except timestamp, appSource, userId)
  environment: z.object({
    currentUrl: z.string().url().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    viewport: z.string().optional(),
    timestamp: z.string().datetime(),
    appSource: z.enum(["web", "admin", "standalone"]),
    deployVersion: z.string().optional(),
    userId: z.string().optional(),
    consoleErrors: z.array(z.string()).optional(),
    errorInfo: z.object({
      message: z.string(),
      stack: z.string().optional(),
    }).optional(),
  }),
});
```

---

### 4. Architecture & Integration

#### 4.1 Package Structure

New shared package: `packages/feedback/`

```
packages/feedback/
  src/
    config/
      feedback.config.ts        # Categories, severities, labels, Linear mapping, all configurable values
      strings.ts                # All hardcoded Spanish UI strings
    components/
      FeedbackForm.tsx           # Main form component (React, shadcn inputs)
      FeedbackFAB.tsx            # Floating action button (minimizable, keyboard shortcut)
      FeedbackModal.tsx          # Modal/drawer wrapper
      FeedbackErrorBoundary.tsx  # Error boundary with report button
      steps/
        StepBasic.tsx            # Step 1: type, title, description, email/name
        StepDetails.tsx          # Step 2: severity, steps, attachments, tech details
    hooks/
      useAutoCollect.ts          # Auto-collect environment data
      useConsoleCapture.ts       # Capture recent console.error calls
      useFeedbackSubmit.ts       # Submit to API endpoint
      useKeyboardShortcut.ts     # Ctrl+Shift+F handler
    lib/
      collector.ts              # Environment data collection logic
      query-params.ts           # Parse/serialize pre-fill data for standalone
    schemas/
      feedback.schema.ts        # Zod schemas
    index.ts                    # Public API exports
  package.json
  tsconfig.json
```

#### 4.2 Integration Points

**apps/web (Astro):**
- `FeedbackFAB` rendered as React island (`client:idle`) in `BaseLayout.astro`
- `FeedbackErrorBoundary` wraps React islands; Astro error pages link to standalone
- Standalone page: `src/pages/[lang]/feedback.astro` .. minimal layout, renders `FeedbackForm`
- Astro 500 error page (`500.astro`) includes a direct link to `/feedback?source=web&error=...`

**apps/admin (TanStack Start):**
- `FeedbackFAB` rendered in root layout component
- `FeedbackErrorBoundary` wraps the app's router outlet
- No standalone page needed (admin users can use web's standalone)

**API endpoint:**
- `POST /api/v1/public/feedback` .. receives form payload (multipart), creates Linear issue with attachments
- No auth required; rate-limited (configurable, default 30 reports per IP per hour)

#### 4.3 Linear API Integration

The API endpoint follows a multi-step flow:

**Step 1: Validate**
- Validate payload with Zod schema
- Validate attachments (type, size, count)

**Step 2: Upload attachments to Linear (if any)**

Linear requires a 2-step file upload process per file:
1. Call `linearClient.fileUpload(contentType, filename, size)` to get a pre-signed URL
2. PUT the file binary to the `uploadUrl` with required headers (including `Content-Type` .. omitting it causes a 403)
3. Collect the returned `assetUrl` for each file

```typescript
// Per-file upload flow
const uploadPayload = await linearClient.fileUpload(file.type, file.name, file.size);
const { uploadUrl, assetUrl, headers } = uploadPayload.uploadFile;

await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    ...Object.fromEntries(headers.map(h => [h.key, h.value])),
    "Content-Type": file.type,
    "cache-control": "max-age=31536000",
  },
  body: fileBuffer,
});
// assetUrl is now usable in markdown
```

**Step 3: Create Linear issue**

Format and create the issue via `@linear/sdk`:
- **Title**: `[{type}] {title}`
- **Description**: Markdown body with all fields formatted. Uploaded images embedded as `![filename](assetUrl)`
- **Labels**: Report type label + source label + "beta" label
- **Priority**: Mapped from severity (or default Medium/3 if not provided)
- **Project**: From `LINEAR_CONFIG.projectId`
- **State**: Triage (from `LINEAR_CONFIG.defaultStateId`)

**Step 4: Retry strategy**

If Linear API fails at any step (upload or issue creation), retries up to 3 times (configurable) with exponential backoff (1s, 2s, 4s).

**Step 5: Email fallback**

If all retries fail, sends a fallback email via `@repo/notifications` (extended with `skipDb` and `skipLogging` options) to the configured address (`FEEDBACK_CONFIG.fallbackEmail`) with the full report data formatted as HTML. Attachments included as base64 inline images in the email.

**Step 6: Response**

Returns success with Linear issue identifier, or a message indicating the report was sent via email.

#### 4.4 Error Boundary Strategy

```
App renders normally
  |
  v
Error occurs in component tree
  |
  v
FeedbackErrorBoundary catches error
  |
  v
Shows friendly error UI:
  "Algo salio mal"
  [Reportar este error]  [Recargar]
  |
  v
User clicks "Report this error"
  |
  +--> Widget JS still works?
  |      YES --> Open FeedbackModal inline, pre-filled with error data
  |      NO  --> Open new tab: /feedback?type=bug-js&error=...&url=...
  |
  v
Form submitted --> Linear issue created
```

For Astro pages (non-React), the `500.astro` page includes a static link to the standalone form with error context passed via query params.

#### 4.5 Console Error Capture

On app initialization, a lightweight interceptor wraps `console.error`:
- Stores the last 10 `console.error` calls in a circular buffer
- Each entry: timestamp + serialized arguments (truncated to 500 chars)
- Buffer is read by `useAutoCollect` when the form opens
- The interceptor is passive (does not modify console behavior)
- Only active when the feedback package is loaded

#### 4.6 Standalone Page Resilience

The standalone page at `/[lang]/feedback` must be crash-resistant:
- Uses a **minimal layout** (no header, no footer, no sidebar, no heavy JS)
- Only loads the `FeedbackForm` React component
- No dependency on API client, auth, or other app infrastructure
- Directly submits to the API endpoint via native `fetch`
- CSS is inlined or minimal (Tailwind utility classes only)
- If even this fails, the page shows a plain HTML fallback with a `mailto:` link

---

### 5. UI/UX Design

#### 5.1 Floating Action Button (FAB)

- Position: bottom-right corner, 24px from edges
- Size: 48px circle (mobile), 56px (desktop)
- Icon: Bug/message icon (from `@repo/icons`)
- Color: Aligned with admin panel light mode primary color, with shadow
- Z-index: Above all content, below modals
- Tooltip on hover: "Reportar un problema (Ctrl+Shift+F)"
- Animation: Subtle pulse every 30s to draw attention during beta (configurable, can be disabled)
- Respects `prefers-reduced-motion`
- **Keyboard shortcut**: `Ctrl+Shift+F` (macOS: `Cmd+Shift+F`) opens/closes the form
- **Minimizable**: Small collapse button on the FAB. When minimized:
  - Shrinks to a 24px dot/pill
  - Hover expands temporarily to show full FAB
  - Click opens the form
  - State persisted in `localStorage` (`feedback-fab-minimized`)
  - Keyboard shortcut still works when minimized

#### 5.2 Form Modal/Drawer

- **Desktop**: Modal centered, max-width 640px
- **Mobile**: Bottom drawer (slides up)
- Backdrop overlay with click-to-close
- Close button (X) in top-right
- Escape key closes the form

#### 5.3 Step 1 (Required)

```
+------------------------------------------+
|  Reportar un problema                [X]  |
+------------------------------------------+
|                                          |
|  Tipo: [Error de JavaScript v]           |
|                                          |
|  Titulo:                                 |
|  [Resumen breve del problema...       ]  |
|                                          |
|  Descripcion:                            |
|  [Describe que paso...                ]  |
|  [                                     ]  |
|  [                                     ]  |
|                                          |
|  Email: [auto@filled.com]  (si no auth)  |
|  Nombre: [Auto Filled]     (si no auth)  |
|                                          |
|  [Agregar mas detalles]    [Enviar]      |
+------------------------------------------+
```

#### 5.4 Step 2 (Optional)

```
+------------------------------------------+
|  Reportar un problema (2/2)         [X]  |
+------------------------------------------+
|                                          |
|  Severidad: [Medio v]                    |
|                                          |
|  Pasos para reproducir:                  |
|  [1. Ir a...                           ]  |
|  [2. Hacer click en...                 ]  |
|                                          |
|  Resultado esperado:                     |
|  [Que deberia pasar...                ]  |
|                                          |
|  Resultado actual:                       |
|  [Que paso en realidad...              ]  |
|                                          |
|  Capturas de pantalla:                   |
|  [+ Subir] archivo1.png [x]             |
|                                          |
|  v Detalles tecnicos (auto-recolectados) |
|  +--------------------------------------+
|  | URL: https://hospeda.com/es/...      |
|  | Navegador: Chrome 120                |
|  | SO: Windows 11                       |
|  | Viewport: 1920x1080                  |
|  | Version: abc1234                     |
|  | Errores de consola: (2 capturados)   |
|  +--------------------------------------+
|                                          |
|  [< Volver]                    [Enviar]  |
+------------------------------------------+
```

#### 5.5 Error Boundary UI

```
+------------------------------------------+
|                                          |
|     (!) Algo salio mal                   |
|                                          |
|  Ocurrio un error inesperado.            |
|  Podes reportar este problema para       |
|  ayudarnos a solucionarlo.               |
|                                          |
|  [Reportar este error]  [Recargar]       |
|                                          |
+------------------------------------------+
```

#### 5.6 Success State

```
+------------------------------------------+
|  Reporte enviado!                   [X]  |
+------------------------------------------+
|                                          |
|  (checkmark icon)                        |
|                                          |
|  Tu reporte fue enviado correctamente.   |
|  Issue: HOS-1234                         |
|                                          |
|  Gracias por ayudarnos a mejorar!        |
|                                          |
|  [Enviar otro]               [Cerrar]    |
+------------------------------------------+
```

---

### 6. API Endpoint Specification

#### POST /api/v1/public/feedback

**Request:** `multipart/form-data` containing form fields + file attachments

**Request fields:** `feedbackFormSchema` (see section 3.6) serialized as form fields, plus `attachments` as file parts.

**Attachment constraints:**
- Max 5 files per request
- Max 10MB per file
- Allowed types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`

**Response (success - Linear created):**
```json
{
  "success": true,
  "data": {
    "linearIssueId": "HOS-1234",
    "linearIssueUrl": "https://linear.app/hospeda/issue/HOS-1234"
  }
}
```

**Response (Linear failed - email fallback sent):**
```json
{
  "success": true,
  "data": {
    "linearIssueId": null,
    "message": "Tu reporte fue enviado por email. Lo revisaremos a la brevedad."
  }
}
```

**Response (validation error):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos invalidos",
    "details": [...]
  }
}
```

**Rate limiting:** Configurable (default 30 requests per IP per hour). Returns `429 Too Many Requests` if exceeded.

---

### 7. Fallback Strategy

When Linear API is unavailable after 3 retries (with exponential backoff: 1s, 2s, 4s):

1. The API formats the full report as an HTML email (same content that would go to Linear)
2. Sends the email via `@repo/notifications` with `skipDb: true` and `skipLogging: true` options (see section 7.1)
3. Email sent to the configured fallback address (`FEEDBACK_CONFIG.fallbackEmail`)
4. Email includes: all form fields, all auto-collected data, and attachments as base64 inline images
5. The email subject follows the same format as Linear: `[{type}] {title}`
6. The API returns success to the user with a message indicating email fallback was used
7. No database table is needed for this feature

#### 7.1 Required changes to `@repo/notifications`

The feedback system needs to send emails without hitting the notification log DB or the preference/logging system. The following changes are required:

**1. Add `attachments` support to `SendEmailInput`:**
```typescript
export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  // NEW:
  attachments?: Array<{
    filename: string;
    content: Buffer | string; // Buffer for binary, string for base64
    contentType?: string;
  }>;
}
```

**2. Pass attachments through `ResendEmailTransport.send()`:**
```typescript
// In ResendEmailTransport.send()
await this.resend.emails.send({
  from, to, subject, react, replyTo, tags,
  attachments, // NEW: pass through to Resend SDK (already supported natively)
});
```

**3. Add `skipDb` and `skipLogging` options to `NotificationService.send()`:**
```typescript
export interface SendNotificationOptions {
  skipDb?: boolean;      // Skip writing to billing_notification_log table
  skipLogging?: boolean; // Skip structured logging via @repo/logger
}
```

This allows the feedback system to send emails without requiring DB access or cluttering notification logs, while still reusing the Resend transport, retry logic, and React Email templates.

**4. Create `FeedbackReportEmail.tsx` template:**

New React Email template in `@repo/notifications` that renders the full feedback report as a formatted HTML email. Uses existing shared components (`EmailLayout`, `EmailHeading`, `InfoRow`).

---

### 8. Environment Variables

```bash
# Linear API
HOSPEDA_LINEAR_API_KEY=lin_api_xxxxx          # Linear API key with issue write access

# Feedback (all other config in feedback.config.ts for easy editing)
HOSPEDA_FEEDBACK_FALLBACK_EMAIL=feedback@hospeda.com  # Fallback email when Linear fails
HOSPEDA_FEEDBACK_ENABLED=true                         # Kill switch for the entire feature
```

Note: Most configuration (team ID, project ID, labels, rate limit, retries, etc.) lives in `feedback.config.ts` rather than env vars, because it needs to be easy to edit and sync with Linear values. Only secrets and deployment-specific values are env vars.

---

### 9. Text Strings (Hardcoded Spanish)

All user-facing text is hardcoded in Spanish in a constants file (`packages/feedback/src/config/strings.ts`). No `@repo/i18n` dependency. This keeps the package lightweight and independent.

Example:
```typescript
export const FEEDBACK_STRINGS = {
  fab: { tooltip: "Reportar un problema (Ctrl+Shift+F)" },
  form: {
    title: "Reportar un problema",
    step2Title: "Reportar un problema (2/2)",
  },
  fields: {
    type: "Tipo",
    title: "Titulo",
    titlePlaceholder: "Resumen breve del problema...",
    description: "Descripcion",
    descriptionPlaceholder: "Describe que paso...",
    email: "Email",
    name: "Nombre",
    severity: "Severidad",
    stepsToReproduce: "Pasos para reproducir",
    stepsPlaceholder: "1. Ir a...\n2. Hacer click en...",
    expectedResult: "Resultado esperado",
    actualResult: "Resultado actual",
    attachments: "Capturas de pantalla",
    uploadButton: "Subir",
  },
  buttons: {
    submit: "Enviar",
    addDetails: "Agregar mas detalles",
    back: "Volver",
    close: "Cerrar",
    submitAnother: "Enviar otro",
    reportError: "Reportar este error",
    reloadPage: "Recargar",
  },
  techDetails: {
    title: "Detalles tecnicos (auto-recolectados)",
    url: "URL",
    browser: "Navegador",
    os: "Sistema operativo",
    viewport: "Viewport",
    version: "Version",
    consoleErrors: "Errores de consola",
  },
  success: {
    title: "Reporte enviado!",
    message: "Tu reporte fue enviado correctamente.",
    issueLabel: "Issue",
    fallbackMessage: "Tu reporte fue enviado por email. Lo revisaremos a la brevedad.",
    thanks: "Gracias por ayudarnos a mejorar!",
  },
  errorBoundary: {
    title: "Algo salio mal",
    message: "Ocurrio un error inesperado. Podes reportar este problema para ayudarnos a solucionarlo.",
  },
  validation: {
    titleMin: "El titulo debe tener al menos 5 caracteres",
    titleMax: "El titulo no puede superar los 200 caracteres",
    descriptionMin: "La descripcion debe tener al menos 10 caracteres",
    descriptionMax: "La descripcion no puede superar los 5000 caracteres",
    emailRequired: "El email es obligatorio",
    emailInvalid: "El email no es valido",
    nameRequired: "El nombre es obligatorio",
  },
  rateLimit: { message: "Demasiados reportes. Intenta de nuevo mas tarde." },
} as const;
```

---

## Part 2 .. Technical Specification

### 10. Implementation Phases

#### Phase 1: Foundation (Package + Schema + Config)

1. Create `packages/feedback/` package with proper monorepo setup (package.json, tsconfig)
2. Define Zod schemas in `packages/feedback/src/schemas/feedback.schema.ts`
3. Create config file with report types, severities, Linear mapping (placeholder IDs), all configurable values
4. Create strings file with all hardcoded Spanish UI text
5. Add environment variables to `@repo/config` (LINEAR_API_KEY, FEEDBACK_FALLBACK_EMAIL, FEEDBACK_ENABLED)
6. Export schemas to `@repo/schemas` (re-export)

#### Phase 1.5: Extend `@repo/notifications`

7. Add `attachments` field to `SendEmailInput` interface
8. Update `ResendEmailTransport.send()` to pass attachments to Resend SDK
9. Add `skipDb` and `skipLogging` options to `NotificationService.send()`
10. Create `FeedbackReportEmail.tsx` React Email template
11. Add `FEEDBACK_REPORT` to `NotificationType` enum + selectTemplate mapping
12. Write tests for new notification features (attachments, skipDb, skipLogging)

#### Phase 2: API Endpoint

13. Create `POST /api/v1/public/feedback` endpoint with multipart form validation
14. Implement Linear API client using `@linear/sdk`:
    - `fileUpload` mutation for pre-signed URLs
    - PUT request for file binary upload (with Content-Type header .. 403 without it)
    - `issueCreate` mutation with markdown description containing `![](assetUrl)` for images
15. Implement retry logic (3 retries with exponential backoff: 1s, 2s, 4s)
16. Implement email fallback via extended `@repo/notifications` (skipDb + skipLogging + attachments)
17. Add rate limiting middleware (configurable, default 30/hour/IP)
18. Write endpoint tests (valid/invalid payloads, Linear mock, file upload mock, retry mock, email fallback mock, rate limiting)

#### Phase 3: Form Components

19. Build `useAutoCollect` hook (browser, OS, viewport, URL, version, user info)
20. Build `useConsoleCapture` hook (circular buffer for console.error)
21. Build `useKeyboardShortcut` hook (Ctrl+Shift+F handler)
22. Build `StepBasic` component (type, title, description, email/name) with shadcn inputs
23. Build `StepDetails` component (severity, steps, expected/actual, attachments, tech details) with shadcn inputs
24. Build `FeedbackForm` component (orchestrates steps, submit logic)
25. Build `FeedbackModal` component (shadcn Dialog on desktop, Drawer on mobile)
26. Build `FeedbackFAB` component (floating button, minimizable, pulse animation)
27. Build `useFeedbackSubmit` hook (multipart form submit, loading/error/success states)
28. Write component tests

#### Phase 4: Error Boundary

29. Build `FeedbackErrorBoundary` component (catch + report UI + inline form or new tab fallback)
30. Implement query param serialization/deserialization for standalone fallback
31. Write error boundary tests

#### Phase 5: App Integration

32. Integrate FAB in `apps/web` BaseLayout (React island, `client:idle`)
33. Integrate error boundary in `apps/web` React islands
34. Update `apps/web` 500.astro with link to standalone form
35. Create standalone page `apps/web/src/pages/[lang]/feedback.astro` (minimal layout)
36. Integrate FAB in `apps/admin` root layout
37. Integrate error boundary in `apps/admin` router
38. Write integration tests

#### Phase 6: Polish & QA

39. Responsive testing (mobile drawer, desktop modal)
40. Accessibility audit (keyboard nav, screen reader, focus management, focus trap in modal)
41. FAB minimize/restore testing + localStorage persistence
42. Rate limiting verification
43. Linear integration E2E test (with mock)
44. Error boundary E2E test (simulate crash, verify form opens pre-filled)
45. Keyboard shortcut E2E test
46. Update Linear config with real IDs (manual step by user)

---

### 11. Dependencies

#### New Dependencies

| Package | Purpose | Used In |
|---------|---------|---------|
| `@linear/sdk` | Linear API client | `packages/feedback`, `apps/api` |
| `ua-parser-js` | Parse user agent string | `packages/feedback` |

#### Internal Dependencies

| Package | Purpose |
|---------|---------|
| `@repo/schemas` | Zod schema re-export |
| `@repo/icons` | FAB icon (bug/message icon) |
| `@repo/config` | Environment variables |
| `@repo/logger` | API logging |
| `@repo/notifications` | Email fallback when Linear fails |

**UI components**: Form inputs use shadcn components (Input, Textarea, Select, Button, Dialog/Drawer) from the admin panel's existing shadcn setup. The feedback package imports these directly.

**Styles**: Hardcoded CSS aligned with admin panel light mode. No `@repo/tailwind-config` dependency. Inline styles or a small CSS file bundled with the package.

**No dependency on**: `@repo/i18n`, `@repo/db`, `@repo/tailwind-config`

---

### 12. Security Considerations

- **Rate limiting**: Configurable (default 30 reports/IP/hour) to prevent abuse
- **Input sanitization**: All text fields sanitized before sending to Linear or email
- **File upload validation**: Type checking, size limits, virus scanning if available
- **No PII in logs**: Email/name not logged, only report IDs
- **Linear API key**: Server-side only, never exposed to client
- **CORS**: Feedback endpoint restricted to app origins
- **Query param injection**: Sanitize all values parsed from URL query params for standalone form

---

### 13. Testing Strategy

| Layer | What | Tool |
|-------|------|------|
| Unit | Zod schema validation, config parsing, collector logic, query param serialization | Vitest |
| Component | FeedbackForm steps, FAB, Modal, ErrorBoundary rendering | Vitest + Testing Library |
| Integration | API endpoint (valid/invalid payloads, rate limiting, Linear mock, file upload mock, email fallback) | Vitest + supertest |
| Integration | `@repo/notifications` extensions (attachments, skipDb, skipLogging) | Vitest |
| E2E | FAB click -> form -> submit flow, error boundary -> report flow | Playwright |

---

### 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Linear API rate limits / downtime | Reports lost | 3 retries with exponential backoff + email fallback |
| FAB conflicts with other floating elements | UI overlap | Z-index management, position testing |
| Form JS fails to load | Can't report | Standalone page with minimal deps + mailto fallback |
| Large file uploads slow | Bad UX | Client-side compression, progress indicator |
| Spam reports | Noise in Linear | Rate limiting (configurable) + honeypot field (hidden field bots fill) |

---

### 15. Resolved Decisions

1. **File storage**: Attachments uploaded directly to Linear via 2-step process (`fileUpload` mutation + PUT). No separate storage needed.
2. **Linear webhook**: Out of scope for beta. Future enhancement to notify users when their reported issue is resolved.
3. **Console capture consent**: No explicit notice needed. All auto-collected data (including console errors) is visible and editable in the form before submission.
4. **FAB visibility**: FAB is minimizable to a 24px dot. State persisted in localStorage. Keyboard shortcut always works.
5. **i18n**: Not needed for beta. All text hardcoded in Spanish in `strings.ts`.
6. **Theming**: Not needed for beta. Styles hardcoded aligned with admin panel light mode.
7. **Fallback strategy**: No DB table. 3 retries to Linear with exponential backoff, then email fallback via `@repo/notifications`.
8. **Form inputs**: shadcn components for consistent UI.
9. **Icons**: From `@repo/icons`.
10. **Email service**: `@repo/notifications` (Resend) with extensions for attachments, `skipDb`, and `skipLogging`.
11. **Linear file upload limits**: No documented hard limits. Using 10MB per file / 5 files max as safe defaults. Linear uses Google Cloud Storage signed URLs (expire in 60s). PUT request MUST include `Content-Type` header or returns 403.

### 16. Open Questions

None .. all questions have been resolved.
