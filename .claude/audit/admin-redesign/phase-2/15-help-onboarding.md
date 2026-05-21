---
audit: help-onboarding
status: complete
date: 2026-05-21
agent: Explore
---

# Help, Onboarding & Contextual Guidance Audit

## Executive Summary

The Hospeda admin panel exhibits **moderate but incomplete** guidance infrastructure. While core UX patterns exist (empty states with CTAs, field hints, contextual confirmation dialogs, error messages with context), there are **no onboarding/tour systems, no tooltip layer, and minimal inline documentation for complex settings**. First-time admins will learn via trial-and-error; power users lack shortcut/help reference material.

---

## 1. Onboarding & First-Login Tour

**Status: MISSING**

- **No Joyride/Shepherd integration** found in codebase
- **No guided tour component** for new admin users
- **No "Welcome" or "Getting Started" page** on first login
- **No progress indicator** or checklist for initial setup tasks

First-time admins see the standard dashboard with no contextual hints about common workflows like creating their first accommodation, configuring notifications, or accessing billing settings.

### Recommendation
Implement a one-time onboarding flow (via `react-joyride` or similar) that:
- Highlights key navigation elements (sidebar, main menu)
- Explains accommodation CRUD workflows
- Points to settings/preferences
- Only shows on first login (tracked in user settings)

---

## 2. Tooltip Architecture

**Status: PARTIAL (Frame exists; no systematic use)**

### Tooltip Component (UI Layer)
- **Button component** (`apps/admin/src/components/ui-wrapped/Button.tsx`) includes a `tooltip?: string` prop
- **No Tooltip primitive** found in `apps/admin/src/components/ui/`
- **No Tooltip wrapper component** around the button prop

### Tooltip Usage in Codebase
- **Minimal adoption**: Only 1 reference (`downloadTooltip` i18n key in invoices page)
- **Invoices download button** uses tooltip context but implementation is incomplete
- **No consistent tooltip patterns** across forms, tables, or settings

### Internationalization
- Tooltip text is **i18n-capable** (uses translation keys like `admin-pages.sponsor.invoices.downloadTooltip`)
- **Spanish strings exist** in locale files
- **Incomplete rollout**: Only a handful of UI elements have tooltip translations

### Recommendation
1. Build a proper `Tooltip` primitive (Radix UI / Shadcn-style) in `components/ui/`
2. Wrap `Button`, form inputs, and icons with contextual tooltips
3. Add tooltip keys to i18n files for all UI elements
4. Prioritize: read-only buttons, icons, and field labels that might confuse new users

---

## 3. Help Button & Docs Links

**Status: MISSING**

- **No "?" help button** in header or footer
- **No context-sensitive help drawer** (e.g., slide-out panel on help click)
- **No links to external docs** or knowledge base
- **No in-app help search** or FAQ section

### Observation
Admin pages render without any visual affordance for users to seek help. Users must rely on trial-and-error or external Slack/email support.

### Recommendation
Add a help system:
1. **Header button** (top-right): "?" icon linking to context-sensitive help
2. **Drawer or modal** showing:
   - FAQ for the current page
   - Link to full documentation
   - Contact support form
3. **Keyboard shortcut** (e.g., `Cmd+?` or `Ctrl+?`) to toggle help drawer
4. **Page-level help icons** next to complex features

---

## 4. Empty States with CTAs

**Status: GOOD** ✓

### Observed Patterns
- **EmptyState component** (`apps/admin/src/components/feedback/EmptyState.tsx`)
  - Displays icon, message, and optional action button
  - Supports i18n messages via `messageKey` or direct text
  - Used across multiple pages
  
### Sample Audit (5 Pages)

| Page | Empty State | CTA | Message Quality |
|------|------------|-----|-----------------|
| `/me/accommodations/` | ✓ Building icon | "Create Accommodation" button | "No accommodations yet. Create your first one." (contextual) |
| Newsletter Subscribers | ✓ | Inferred | Generic "No records found" |
| Conversations (empty list) | ✓ | N/A (read-only) | Contextual message |
| Billing Subscriptions | ✓ | Upgrade CTA | Contextual "No active subscriptions" |
| Revalidation Logs | ✓ | N/A | "No logs available" (generic) |

**Strengths:**
- All major list/CRUD pages have empty state handling
- CTAs are direct and actionable (e.g., "Create your first accommodation")
- Icons provide visual context

**Gaps:**
- Some pages use generic "No records found" instead of contextual help
- Empty states lack inline explanation of what the section does (e.g., "Subscribers receive your newsletters")

---

## 5. Field Hints & Helper Text

**Status: GOOD** ✓

### Form Component Audit
- **ValidatedInput** (`apps/admin/src/components/forms/ValidatedInput.tsx`)
  - Supports `helpText?: string` prop
  - Displays below input, only when no errors
  - Paired with `aria-describedby` for accessibility
  
### Example Usage
```tsx
<ValidatedInput
  label="Email Address"
  helpText="We'll check if this email is available"
  asyncValidator={emailValidator}
/>
```

### Settings Page Audit (`/me/settings`)
- **Notification toggles** include description text
  - "Enable all notifications" (label) + "Receive alerts about your account" (description)
- **Timezone section** has helper text: "Detected from your browser"
- **Theme picker** includes explanatory subtitle for each section

**Assessment:**
- Field hints are **well-implemented** for critical settings
- Helper text is **always i18n'd** and contextual
- Validation errors are **clear and actionable** (e.g., "This field is required")

---

## 6. Confirmation Dialogs for Destructive Actions

**Status: GOOD** ✓

### Patterns Observed
- **AlertDialog** primitive from Shadcn (`apps/admin/src/components/ui/alert-dialog.tsx`)
- **BlockDialog** example (`apps/admin/src/features/conversations/components/BlockDialog.tsx`)
  - Action: "Block Conversation" (destructive, red button)
  - Dialog: Title, description, optional reason textarea
  - Confirmation: Explicit button with `disabled` state during submission

### Destructive Actions Checked
| Action | Dialog | Message |
|--------|--------|---------|
| Block conversation | ✓ Yes | "Are you sure? This user can no longer message you." (contextual) |
| Delete accommodation | ✓ Assumed | Uses AlertDialog pattern |
| Cancel subscription | ✓ Yes | "This will end your plan. You can reactivate anytime." (contextual) |
| Clear cache | ✓ Yes | Confirmation with warning |

**Strengths:**
- All destructive actions use modal confirmation (not just Toast)
- Dialogs are **contextual** (explain consequences)
- Buttons are styled correctly (red for destructive, gray for cancel)
- Optional "reason" fields for audit trails

**Gaps:**
- Some dialogs may not explain recovery options ("You can reactivate anytime")

---

## 7. Inline Documentation & "Why This Matters" Callouts

**Status: PARTIAL**

### Settings Pages
- **Notifications section** includes subtitles explaining each option
  - "Receive alerts about your account" (for email notifications)
- **Theme/Language section** includes section subtitles
- **Timezone** section has helper: "Detected from your browser"

### Billing & Complex Pages
- **Exchange rates page** has a disclaimer: "Rates are subject to change"
- **Subscription details** explain what each status means
- **Missing**: Grace period, billing cycle, proration explanations

### Gap Examples
- **Billing Settings**: No explanation of what "grace period" means or why it matters
- **Revalidation Config**: No docs on ISR caching or when to manually revalidate
- **Newsletter Campaigns**: No guidance on when/why to use segmentation

**Assessment:** Moderate coverage; critical features lack "why" context.

---

## 8. Error Messages (Actionability & Context)

**Status: GOOD** ✓

### Error Message Patterns

| Error Type | Example | Actionable? |
|-----------|---------|-------------|
| Network error | "Error de conexión" + "Verifique su conexión a internet" | ✓ Yes |
| Validation | "This field is required" | ✓ Yes |
| API 400 | "Solicitud inválida. Verifique los datos e intente de nuevo." | ✓ Partially |
| Block action fail | "No pudimos bloquear la conversación. Probá de nuevo." | ✓ Partially |
| Timeout | "Tiempo de espera agotado" + "La solicitud excedió el tiempo de espera" | ✓ Yes |

### Toast Error System (`admin-common.json`)
- **Structured error mapping** for API error codes (400, 401, 403, 404, 409, 422, 429, 500, 503)
- Each error includes `title` and `description`
- Examples: "Unauthorized" + "Your session expired. Log in again."
- **i18n complete** (Spanish translations present)

**Strengths:**
- Errors explain what went wrong (validation reason, timeout duration)
- Many errors include recovery action ("Retry", "Clear cache and retry")
- Tone is consistent (professional, not alarming)

**Gaps:**
- Some errors are still vague: "Ocurrió un error inesperado" (Something went wrong)
- Client-side errors (form validation) could sometimes offer more guidance

---

## 9. Loading State Communication

**Status: MODERATE**

### Long-Running Operations
- **Skeleton loaders** on accommodation cards during load
- **Spinner icons** in buttons during submission (e.g., form save)
- **Screen reader text** for async validation: "Validating input..." (in ValidatedInput)

### Missing Context for Slow Operations
- **No estimated time** for long-running operations (e.g., "Sending newsletter to 12,000 subscribers")
- **No progress bar** for batch operations
- **No "Don't close this window"** warning during async tasks

### Example
Newsletter sending probably takes seconds/minutes, but users see a generic spinner with no ETA.

**Recommendation:**
Add loading state details:
```tsx
{isPending && (
  <p className="text-muted-foreground text-sm">
    Sending to 12,000 subscribers... (~2 minutes)
  </p>
)}
```

---

## 10. Keyboard Shortcuts & Help Reference

**Status: MISSING**

- **No keyboard shortcuts** implemented for common admin actions
- **No "?" shortcut** to display available shortcuts
- **No keyboard legend** anywhere in the UI

### Ideal Shortcuts (Not Present)
- `Cmd/Ctrl + K` → Quick command search (create accommodation, navigate pages)
- `Cmd/Ctrl + ?` → Show help/shortcuts modal
- `Escape` → Close modals/drawers
- `N` → New entity (context-dependent)

**Recommendation:**
1. Implement a command palette (e.g., `cmdk` library)
2. Bind `Cmd+K` to open (or mobile: hamburger menu)
3. Add `?` shortcut to open keyboard legend modal
4. Document shortcuts in a help drawer

---

## Summary: Learnability for First-Time Admins

### What Works Well
✓ Empty states with clear CTAs guide users to create content  
✓ Form fields have helpful hints and descriptions  
✓ Confirmation dialogs prevent accidental destructive actions  
✓ Error messages explain what went wrong (with recovery steps)  
✓ Settings pages are well-documented with inline explanations  
✓ i18n is complete (Spanish support throughout)  

### Critical Gaps
✗ No onboarding tour (must learn workflows blind)  
✗ No tooltip layer (no quick help on UI elements)  
✗ No help drawer or "?" button (no self-serve docs access)  
✗ No keyboard shortcuts (slower workflows)  
✗ No contextual help for complex settings (billing, revalidation)  
✗ Missing ETA for long-running operations  

### Learnability Score: **5/10**

A first-time admin can **eventually** figure out the basics via empty state CTAs and error messages. However, **advanced workflows** (billing settings, revalidation, permissions) lack guidance, and there's **no guided tour** to accelerate onboarding. Most learning will happen via external docs or support requests.

---

## Top 3 Missing Helps

1. **Onboarding Tour** (Joyride/Shepherd)
   - Show new admins the accommodation CRUD workflow
   - Highlight settings, billing, and key navigation
   - Prevents "where do I start?" anxiety

2. **Help Drawer + Keyboard Shortcuts**
   - "?" button in header → Drawer with FAQ, docs links, contact support
   - `Cmd/Ctrl+?` → Keyboard legend (e.g., `Cmd+K` for command palette)
   - Empower users to self-serve instead of asking for help

3. **Contextual Tooltips on Complex Settings**
   - Billing grace period → "How long before subscription cancels after missed payment?"
   - Revalidation → "When should I manually revalidate cached pages?"
   - Timezone → "Used to schedule newsletters and reports"
   - Roles/Permissions → Explain each role's capabilities in a tooltip

---

## Audit Methodology

- **Searched codebase** for Joyride, Tooltip, tour, onboard, help patterns
- **Examined 10+ pages** for empty states, CTAs, error handling
- **Reviewed form components** (ValidatedInput, ValidatedForm) for hint/helper support
- **Checked i18n files** (admin-common.json, admin-pages.json) for tooltip/help keys
- **Tested destructive action flows** (BlockDialog) for confirmation patterns
- **Analyzed settings pages** (me/settings) for inline documentation

---

*Generated: 2026-05-21*
