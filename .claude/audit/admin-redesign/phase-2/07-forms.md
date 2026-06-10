---
audit: forms
status: complete
date: 2026-05-21
agent: Explore
---

# Forms Audit: Hospeda Admin Panel

## Executive Summary

The hospeda admin panel uses **two parallel form patterns**: (1) a **declarative entity form system** for CRUD operations on major entities (accommodations, posts, events, etc.), and (2) **ad-hoc TanStack Form implementations** for utility/dialog forms (conversations, billing settings, exchange rates). The declarative system is highly sophisticated but not exported as a reusable library; smaller forms reinvent validation and error handling. There is no React Hook Form or Zod resolver use—the stack uses **TanStack Form with local Zod validators** and **Zod schemas from `@repo/schemas`**.

---

## 1. Form Architecture Overview

### 1.1 Declarative Entity Form System (Major CRUD)
**Location**: `/apps/admin/src/components/entity-form/` + `/apps/admin/src/features/{entity}/config/`

The admin panel implements a sophisticated **data-driven form system**:
- **EntityFormContext** wraps TanStack Form instance + validation state + entity config
- **EntityFormSection** renders fields dynamically from a `SectionConfig` object (defines layout, field types, permissions, modes)
- **EntityPageBase** orchestrates the form, mode (view/edit/create), and lifecycle
- **EntityCreateContent** and **EntityEditContent** handle create/edit workflows with navigation, lazy loading, and autosave logic
- **Field components** (TextField, SelectField, GalleryField, RichTextField, etc.) are specialized wrappers around shadcn/ui primitives with label + error + help text

**No form library abstraction**: The system is built entirely on TanStack Form with custom validation hooks (useCrossFieldValidation, useAsyncValidation) but is not exported as a reusable npm package. It is embedded in the admin app.

### 1.2 Ad-Hoc Dialog/Utility Forms (TanStack Form)
**Locations**: 
- `/apps/admin/src/features/conversations/components/ReplyForm.tsx`
- `/apps/admin/src/features/exchange-rates/components/FetchConfigForm.tsx`
- `/apps/admin/src/features/billing-plans/components/PlanDialog.tsx`
- `/apps/admin/src/features/billing-addons/components/AddonDialog.tsx`

Simple forms for secondary operations. Each implements its own:
- TanStack Form instance
- Local Zod validators defined inline (`bodyValidator = z.string().min(...).max(...)`)
- Manual field error handling
- Toast feedback via `useToast()`

No shared validation wrapper; each form manually configures onBlur/onChange behavior.

---

## 2. Schema Source & Zod Usage

### 2.1 Schema Import Pattern (Consistent)
All entity CRUD pages import create/update Zod schemas from `@repo/schemas`:

```tsx
// apps/admin/src/routes/_authed/posts/new.tsx
import { PostCreateInputSchema } from '@repo/schemas';

// apps/admin/src/routes/_authed/posts/$id_.edit.tsx
import { PostUpdateInputSchema } from '@repo/schemas';
```

**Schemas are available for**:
- accommodation, amenity, attraction, conversation
- destination, event, event-organizer, event-location
- newsletter, post, post-sponsor, post-sponsorship
- sponsorship, tag, user
- All billing entities (plans, addons, subscriptions, etc.)

**No local duplication**: Entity forms do not redefine schemas locally. Schemas are passed to `EntityCreateContent/EntityEditContent` for client-side validation before submission.

### 2.2 Zod Resolver Pattern (NOT Used)
**React Hook Form is not installed**. The stack uses **TanStack Form + manual Zod validation**:

```tsx
// Example from ReplyForm
const form = useForm({
  defaultValues: { body: '' },
  onSubmit: async ({ value }) => { /* ... */ }
});

form.Field name="body" validators={{
  onChange: ({ value }) => {
    const result = bodyValidator.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  }
}}
```

**No `zodResolver`**: Validation is done manually via `safeParse()` and error extraction. This is repeated across forms.

---

## 3. Field Components & Wrapper Pattern

### 3.1 Shared Field Components (Declarative Forms)
**Location**: `/apps/admin/src/components/entity-form/fields/`

The declarative system provides **specialized field components**:
- `TextField` (text input)
- `TextareaField` (multi-line)
- `RichTextField` (Tiptap editor)
- `SelectField` (dropdown)
- `CheckboxField`, `SwitchField` (toggles)
- `GalleryField` (image carousel with upload/delete)
- `ImageField` (single image)
- `CurrencyField` (with formatting)
- Entity-specific: `AccommodationSelectField`, `DestinationSelectField`, `EventSelectField`, `UserSelectField`, `PostSponsorshipSelectField`

**Wrapper pattern**:
```tsx
// Rendered in EntityFormSection
<TextField
  id="name"
  value={readValue(values, field.id)}
  onFieldChange={(value) => onFieldChange(field.id, value)}
  onFieldBlur={() => onFieldBlur(field.id)}
  error={errors[field.id]}
  label={label}
  helpText={helpText}
  required={field.required}
  disabled={isDisabled}
/>
```

Each field component:
- Handles label rendering (with required asterisk)
- Displays inline error below input
- Shows help text
- Manages validation state (inline, border color, icon)
- No explicit `aria-invalid` or `aria-describedby` (gaps in a11y)

### 3.2 UI Primitives (shadcn/ui)
**Location**: `/apps/admin/src/components/ui-wrapped/` and shadcn/ui defaults

Forms use **Radix UI + shadcn/ui**:
- Input, Textarea, Select (Radix dropdowns)
- Button, Switch, Checkbox
- All wrapped for consistency

**No form-specific wrapper** (like FormField from react-hook-form). Instead, field components manually compose label + input + error.

### 3.3 Ad-Hoc Forms (Dialog/Utility)
Forms like `ReplyForm` and `FetchConfigForm` **do not use the specialized field components**. Instead, they wire TanStack Form.Field directly to shadcn primitives:

```tsx
<form.Field name="body" validators={{...}}>
  {(field) => (
    <div className="flex flex-col gap-1">
      <Textarea
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
        <p className="text-destructive text-xs">{t(field.state.meta.errors[0])}</p>
      )}
    </div>
  )}
</form.Field>
```

**No label, help text, or structured error display** for dialog forms.

---

## 4. Validation Feedback & Timing

### 4.1 Declarative Forms
**Validation timing**: Configurable via section/field mode:
- Fields validate on **blur** by default (TouchedFieldState)
- Errors shown **inline below field** (TextareaField shows min/max warnings)
- **Global form errors** displayed at top in an alert box
- **Submission-time errors** from API are parsed and merged into field errors

**Example** (from ValidatedInput):
```tsx
// Async validation debounced to 300ms, shows spinner while validating
if (isValidating) <LoaderIcon />
if (isValid) <CheckIcon className="text-green-500" />
if (hasError) <CloseIcon className="text-destructive" />
```

**No onBlur/onChange toggle**: Timing is baked into the validation hook logic.

### 4.2 Ad-Hoc Forms
**Validation timing**: Manual, inconsistent:
- **ReplyForm**: Validates on change (field.state.meta.errors updated on keystroke)
- **FetchConfigForm**: Validates on submit only (custom validation inside onSubmit)

**Error display**: 
- **ReplyForm**: Inline `<p>` below textarea only if `field.state.meta.isTouched`
- **FetchConfigForm**: Toast on submit failure (no inline errors)

---

## 5. Submit UX & Loading States

### 5.1 Declarative Forms
**Submit button state**:
```tsx
// EntityEditContent
const handleSave = async () => {
  try {
    await save();
    addToast({ variant: 'success', ... });
  } catch (error) {
    addToast({ variant: 'error', ... });
  }
};
```

- Button disabled while `isSaving`
- LoaderIcon shown during save
- Success toast displayed after save
- Error toast + inline field errors on API validation failure
- **No optimistic updates** (changes applied only after server confirms)

### 5.2 Ad-Hoc Forms
**Submit behavior**:
- Button disabled while mutation `isPending`
- No spinner state (LoaderIcon not shown in ReplyForm, custom loading in FetchConfigForm)
- Toast feedback on success/failure
- No optimistic updates

---

## 6. Multi-Step / Wizard Forms

**No multi-step forms found in the codebase.**

The largest entity (accommodation) has **7 sections** in a single form, but they are:
- Not sequential steps
- All fields are visible in a **sidebar navigation** (scrollable list of sections)
- User can jump to any section at any time

**Navigation pattern** (SmartNavigation):
- Tracks section completion based on field values
- Auto-scrolls to first error
- Breadcrumb shows current section
- Sidebar shows progress per section

---

## 7. File Upload Forms

### 7.1 Gallery Field (GalleryField.tsx)
**Entity forms** (accommodation, posts, events) use `GalleryField`:
```tsx
// In EntityEditContent
fieldHandlers={{
  images: {
    onUpload: createUploadHandler({ ... }),
    onDelete: (publicId) => deleteImage.mutateAsync({ publicId })
  }
}}
```

- Drag-and-drop reordering via @dnd-kit
- Progress bar per image (UploadProgressIndicator)
- Cloudinary URL detection (removes Cloudinary assets via `deleteImage` API)
- Non-Cloudinary URLs deleted without API call

**Shared component**: All gallery fields wire handlers identically.

### 7.2 Avatar Field (AvatarUpload.tsx)
Single-image upload for user profiles:
- File input with preview
- Delete button
- No progress bar (synchronous upload assumed)

---

## 8. Repeated Form Shapes (Create + Edit)

### 8.1 Pattern: Shared Configuration
**Accommodations**: 
- `apps/admin/src/routes/_authed/content/accommodation/new.tsx` and `$id_.edit.tsx` both use:
  - `createAccommodationConsolidatedConfig()` (same config for both)
  - `AccommodationCreateInputSchema` and `AccommodationUpdateInputSchema` (separate schemas, same fields)
  - Both pass config to `EntityCreateContent` / `EntityEditContent`

**Posts**:
- `apps/admin/src/routes/_authed/posts/new.tsx` and `$id_.edit.tsx`:
  - `createPostConsolidatedConfig()`
  - `PostCreateInputSchema` / `PostUpdateInputSchema`

**Reuse achieved via**: 
- Shared `ConsolidatedSectionConfig` (sections array)
- Separate create/update route pages
- Single form component (EntityCreateContent or EntityEditContent) handles layout

**NOT achieved via**: No single `<PostForm>` component wrapping both new and edit. Instead, routes call the generic EntityCreateContent / EntityEditContent with entity-specific config.

---

## 9. Accessibility & Standards

### 9.1 ARIA & Semantics
**Declarative forms**:
- ValidatedInput includes `aria-invalid`, `aria-describedby`
- Error messages linked via `id={id}-error`
- Help text linked via `id={id}-help`
- Screen reader feedback: `<div aria-live="polite" aria-atomic="true">`

**Ad-hoc forms**:
- Missing `aria-invalid` and `aria-describedby` on most inputs
- No structured error IDs
- ReplyForm includes `aria-label` on textarea

### 9.2 Label & Error Associations
**Declarative forms**: Labels via `<label htmlFor={id}>` ✓

**Ad-hoc forms**: 
- ReplyForm: No label (uses placeholder + aria-label)
- FetchConfigForm: Label via shadcn Label component ✓

---

## 10. Summary of Patterns & Inconsistencies

| Aspect | Declarative Entity Forms | Ad-Hoc Dialog Forms | Status |
|--------|-------------------------|---------------------|--------|
| Form library | TanStack Form | TanStack Form | Consistent |
| Schema source | @repo/schemas | Inline Zod or none | Mixed |
| Validation timing | onBlur (configurable) | on change or submit | Ad-hoc |
| Error display | Inline + top alert | Inline (if touched) or toast | Inconsistent |
| Field wrappers | TextField, SelectField, etc. | Direct Radix/shadcn | Different patterns |
| Submit state | Loading icon, disabled button | Disabled button only | Inconsistent |
| A11y coverage | High (aria-invalid, aria-describedby) | Medium-low (missing ARIA) | Gaps in dialogs |
| Create + Edit share | Config-driven (same sections) | N/A (not applicable) | Good for CRUD |
| File uploads | GalleryField + handlers | N/A (no file forms in dialogs) | Centralized |

---

## 11. Findings & Recommendations

### Finding 1: Two Form Systems with Limited Cross-Pollination
The **declarative entity form system is sophisticated** but siloed. Ad-hoc forms (conversations, billing settings) do not benefit from shared field components, validation wrappers, or error patterns. Reusing the declarative system requires:
1. Lifting the entire EntityFormContext and entity-config logic (heavy)
2. Or: Extracting ValidatedInput/TextField patterns into a standalone library

**Recommendation**: Create a minimal **form-components package** exporting:
- `FormField` (label + input + error + help, with Zod integration)
- `FormSelect`, `FormTextarea`, `FormCheckbox` variants
- `FormRoot` (TanStack Form wrapper with submission state)
- Export from `@repo/form-components` for use across admin and other apps

### Finding 2: Validation Timing Not Standardized in Dialogs
Dialog forms like `FetchConfigForm` validate only on submit, while `ReplyForm` validates on change. No documented pattern for which to use when.

**Recommendation**: Define a **form-patterns doc**:
- "Simple single-field forms" (reply, email) → validate on change
- "Multi-field configs" (billing settings) → validate on submit
- "Complex CRUD" (entities) → validate on blur

### Finding 3: Error Feedback Inconsistency
Entity forms show errors inline + in a top alert. Dialog forms show errors inline or only in a toast. Users cannot see field-level errors in FetchConfigForm after submission.

**Recommendation**: Standardize on:
- Inline error (required, always below field)
- Top alert for form-level errors (e.g., "could not save—connection lost")
- Toast for transient feedback (e.g., "saved successfully")

### Finding 4: No Optimistic Updates
All forms wait for server response. Large forms (accommodation with 7 sections) feel slow.

**Recommendation**: Implement optimistic updates in EntityEditContent:
```tsx
// Apply value immediately, revert on error
setFieldValue(fieldId, newValue); // Show immediately
await save().catch(() => setFieldValue(fieldId, oldValue));
```

### Finding 5: Gallery Field Handlers Repetitive
Each entity defines `fieldHandlers` manually in its edit route. The pattern is identical.

**Recommendation**: Extract `useGalleryFieldHandlers(entityType, entityId)` hook:
```tsx
const galleryHandlers = useGalleryFieldHandlers('accommodation', id);
<EntityEditContent fieldHandlers={galleryHandlers} />
```

---

## 12. Cleanest & Messiest CRUD Implementations

### Cleanest: **Posts** (create + edit)
- Config-driven sections (basic-info, seo, sponsorship)
- Schemas imported cleanly from @repo/schemas
- Gallery field with proper handlers
- No inline validation logic
- Clear route structure

### Messiest: **Exchange Rates** (fetch config form)
- Custom validation in onSubmit (not reusable)
- Toast-only error feedback (no inline errors)
- Manual TanStack Form setup with no field abstraction
- Min/max validation duplicated (form-level in onSubmit, not in field)

### Runner-Up Messiest: **Billing Plans** (plan dialog)
- No proper error display (toasts only)
- Inline validation mixed with submission logic
- Heavy use of nested if/else for field rendering

---

## Conclusion

The admin panel's form architecture is **split**: sophisticated declarative system for entities, ad-hoc TanStack Form for utilities. Schemas are centralized and Zod is standard, but validation & error patterns differ. Extracting a reusable form-components package and standardizing validation timing and error UX would significantly reduce duplication and improve consistency.

