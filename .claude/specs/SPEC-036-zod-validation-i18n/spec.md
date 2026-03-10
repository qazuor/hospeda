# SPEC-036: Unified Zod Validation Error i18n System

> **Status**: completed
> **Created**: 2026-03-07
> **Last updated**: 2026-03-10
> **Complexity**: high
> **Type**: feature + bugfix
> **Estimated effort**: 5-7 days
> **Depends on**: None
> **Blocks**: None

---

## 1. Problem Statement

The codebase has **~1,037 unique `zodError.*` message keys** defined across Zod schemas in `@repo/schemas` and 5 additional files, but **zero translations** exist in the i18n system. This creates four concrete problems:

1. **API response format bug**: When `@hono/zod-openapi` route validation fails, `@hono/zod-validator` returns HTTP 400 with Zod's raw error format (`{ success: false, error: { issues: [...] } }`) instead of the API's standard envelope format (`{ success: false, error: { code, message, details } }`). This is because no `defaultHook` is configured on the `OpenAPIHono` router, so the validator middleware handles the error directly instead of passing it through `transformZodError()`.

2. **No validation i18n**: The ~1,037 zodError keys (e.g., `zodError.amenity.displayWeight.required`) are string literals that never pass through the i18n system. When they surface to users (in admin error messages), they get either the raw key string or a generic hardcoded Spanish message from `formatZodErrorMessage()`.

3. **Dual error systems**: Two parallel, incompatible systems exist:
   - **Schema-level**: `zodError.{entity}.{field}.{type}` keys in `@repo/schemas` (~1,037 keys)
   - **API transformer**: `validationError.field.*` keys in `zod-error-transformer.ts` (23 generic keys)

   Neither has translations, and they use different namespaces and approaches.

4. **Admin forms lack Zod validation**: `EntityFormProvider.tsx` has four TODOs (lines 60, 151, 199, 221). Two are about Zod integration (line 151: schema validation, line 221: field validation) and two are about error handling (lines 60 and 199: save errors). Currently, only manual required-field validation exists. `validateField()` on blur is a no-op that returns `undefined`. Additionally, `handleSave()` in `EntityCreateContent.tsx` does NOT call `validateForm()` before submitting.. it sends directly to the API. A separate `formatZodErrorMessage()` function in `EntityCreateContent.tsx` (lines 25-45) provides hardcoded Spanish fallbacks without using i18n.

## 2. Goals

1. Fix the API router to format Zod validation errors using `transformZodError()` via `defaultHook` (standard envelope)
2. Create unified `validation` i18n namespace with Spanish translations for all ~1,037 zodError keys
3. Unify the two error systems into a consistent approach
4. Integrate Zod schema validation into admin form components (client-side)
5. Display translated, human-readable validation errors in admin forms

**Non-Goals**:

- Translating to EN/PT (deferred.. placeholder files only)
- Adding new Zod validations
- Changing Zod schemas themselves
- Modifying web app form validation
- Adding real-time keystroke validation (only on blur and submit)
- Modifying `ValidatedForm.tsx` (see section 3.7 for rationale)
- Refactoring `.refine()` messages to use zodError keys (see section 3.8 for inventory)

## 3. Current State Analysis

### 3.1 zodError Key Inventory

**Total**: ~1,037 unique keys across ~42 namespaces

**Primary location**: `packages/schemas/src/` (126 files)

**Secondary locations** (3 files outside schemas):

- `apps/api/src/types/validation-messages.ts` .. keys like `zodError.validation.content_type.invalid` (also uses underscore naming: `content_type`, `invalid_format`, etc.)
- `apps/api/src/schemas/base-schemas.ts` .. keys with underscore naming (see section 3.1.1)
- `apps/api/src/routes/exchange-rates/admin/index.ts` .. `zodError.exchangeRate.id.invalid`

**Note**: `packages/service-core/src/base/base.service.ts` does NOT contain zodError i18n keys. The word `zodError` in that file is a catch variable name, not a string key.

Top 15 namespaces by key count:

| Namespace | Keys | Namespace | Keys |
|-----------|------|-----------|------|
| billing | 110 | admin | 33 |
| common | 109 | enums | 32 |
| tag | 71 | location | 31 |
| feature | 65 | attraction | 26 |
| event | 51 | exchangeRate | 25 |
| amenity | 50 | eventLocation | 24 |
| user | 49 | destination | 21 |
| post | 49 | | |

**Validation types**: `min` (~227), `required` (~226), `invalidType` (~187), `max` (~167), `int` (~40), `uuid` (~27), `enum` (~16), `pattern` (~13), `positive` (~12), `format` (~11), and others

**Key format**: All keys are string literals passed as the `message` parameter in Zod validation methods.

**Key depth distribution**:

- 4 segments (dominant, 50%): `zodError.namespace.field.validation`
- 5 segments (45%): `zodError.namespace.field.subfield.validation`
- 6-7 segments (5%): Deep nested objects like `zodError.accommodation.price.additionalFees.isIncluded.required`

#### 3.1.1 Naming Inconsistency: Underscore Keys

Two files use **underscore** naming in keys instead of camelCase:

**`apps/api/src/schemas/base-schemas.ts`**:

- `zodError.common.id.invalid_uuid` (vs expected `zodError.common.id.invalidUuid`)
- `zodError.common.pagination.page.min_value`
- `zodError.common.pagination.pageSize.max_value`
- `zodError.common.date.start_date.invalid`
- `zodError.common.language.invalid_format`

**`apps/api/src/types/validation-messages.ts`**:

- `zodError.validation.content_type.invalid`
- `zodError.validation.request.too_large`
- `zodError.validation.request.invalid_format`

**Decision**: These keys are treated as literal i18n key paths. The translation JSON MUST include both naming styles. The `resolveValidationMessage()` helper does NOT normalize casing.. it maps keys as-is.

#### 3.1.2 Dynamic Key Generation

`packages/schemas/src/utils/http-field.factory.ts` generates keys using template literals:

```typescript
// Pattern: zodError.common.${options.field}Price.tooLow
// Resolves to: zodError.common.minPrice.tooLow, zodError.common.maxPrice.tooLow

// Pattern: zodError.common.${type}.tooLow
// Resolves to: zodError.common.latitude.tooLow, zodError.common.longitude.tooLow

// Pattern: zodError.common.${fieldName}.invalidDate
// Resolves to: zodError.common.checkIn.invalidDate, zodError.common.checkOut.invalidDate

// Pattern: zodError.common.${fieldName}.invalidBoolean
// Resolves to: zodError.common.isActive.invalidBoolean, zodError.common.isFeatured.invalidBoolean
```

The extraction script (Task 1.1) MUST resolve these by scanning call sites of the factory functions to enumerate all actual field names used.

### 3.2 API Validation Error Flow (The Bug)

**File**: `apps/api/src/utils/create-app.ts` (lines 75-79)

```typescript
export function createRouter() {
    return new OpenAPIHono<AppBindings>({
        strict: false
        // BUG: No defaultHook configured
    });
}
```

When `@hono/zod-openapi` route validation fails and no per-route hook exists, `@hono/zod-validator` internally does:

```typescript
if (!result.success) {
    return c.json(result, 400);  // Raw Zod SafeParseResult
}
```

This returns:

```json
{
    "success": false,
    "error": {
        "issues": [
            {
                "code": "too_small",
                "message": "zodError.amenity.name.min",
                "path": ["name"]
            }
        ]
    }
}
```

**Expected** (standard API envelope):

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "validationError.validation.failed",
        "details": {
            "code": "VALIDATION_ERROR",
            "message": "validationError.validation.failed",
            "translatedMessage": "Validation failed",
            "userFriendlyMessage": "Please fix the validation errors",
            "details": [
                {
                    "field": "name",
                    "message": "zodError.amenity.name.min",
                    "translatedMessage": "...",
                    "userFriendlyMessage": "Name must be at least 2 characters long",
                    "code": "TOO_SMALL",
                    "params": { "min": 2, "inclusive": true }
                }
            ],
            "summary": { "totalErrors": 1, "fieldCount": 1, "errorsByField": { "name": 1 }, "mostCommonError": "TOO_SMALL" }
        }
    },
    "metadata": { "timestamp": "...", "requestId": "..." }
}
```

### 3.3 API Transformer

**File**: `apps/api/src/utils/zod-error-transformer.ts` (641 lines)

Already implements `transformZodError(error: ZodError): ValidationErrorResponse`. Contains:

- `ZOD_ERROR_CODE_MAP`: 23 entries mapping Zod codes to standardized codes
- `ZOD_ERROR_MESSAGE_MAP`: 23 entries mapping to `validationError.field.*` i18n keys
- Extracts params (`min`, `max`, `expected`, `received`, `options`)
- Generates user-friendly messages with context-aware suggestions
- Creates error summary with field-level aggregation

**Currently used**: Only by manual validation middleware (`apps/api/src/middlewares/validation.ts`, line 119) when `options.manualZodSchema` is provided. NOT used for `@hono/zod-openapi` route-level validation.

**Return type**:

```typescript
interface ValidationErrorResponse {
    code: string;                           // 'VALIDATION_ERROR'
    message: string;                        // 'validationError.validation.failed'
    translatedMessage: string;              // 'Validation failed'
    userFriendlyMessage: string;            // 'Please fix the 2 validation errors'
    details: TransformedValidationError[];
    summary: ValidationErrorSummary;
}

interface TransformedValidationError {
    field: string;                          // 'email' or 'user.profile.name'
    message: string;                        // Translation key (from ZOD_ERROR_MESSAGE_MAP)
    translatedMessage: string;              // Schema's custom message (e.g., zodError.*.*)
    userFriendlyMessage: string;            // English fallback
    code: string;                           // 'INVALID_EMAIL', 'TOO_SMALL', etc.
    params?: Record<string, unknown>;       // { min: 3, max: 50 }
    suggestion?: string;                    // 'Use format: name@domain.com'
}
```

**Key observation**: The `message` field contains a generic key from `ZOD_ERROR_MESSAGE_MAP`, while `translatedMessage` contains the schema's custom `zodError.*` key. This naming is counterintuitive and should be understood when implementing the defaultHook.

### 3.4 Admin Form Validation Flow

#### 3.4.1 EntityFormProvider

**File**: `apps/admin/src/components/entity-form/providers/EntityFormProvider.tsx`

**TODOs** (4 total):

- Line 60: `// TODO: Handle save errors properly` (in onSubmit catch)
- Line 151: `// TODO: Implement Zod schema validation for more complex rules` (Zod)
- Line 199: `// TODO: Handle save errors properly` (in handleSaveAndPublish catch)
- Line 221: `// TODO: Implement field validation using Zod schemas` (Zod)

**Current validation**:

- `validateForm()` (line 142-147): Only checks `field.required` for fields with truthy `required` config
- `validateField()` (line 221-228): No-op stub, returns `undefined`
- `handleSave()` (line 174): Calls the save handler directly WITHOUT calling `validateForm()` first
- `onSubmit()` (line 52): Does NOT call `validateForm()`.. validation only triggers when explicitly called
- **Critical gap**: No component in the chain calls `validateForm()` before API submission

#### 3.4.2 EntityCreateContent

**File**: `apps/admin/src/components/entity-pages/EntityCreateContent.tsx`

**`formatZodErrorMessage()`** (lines 25-45): Hardcoded Spanish-only function:

```typescript
function formatZodErrorMessage(message: string): string {
    if (!message.startsWith('zodError.')) return message;
    const parts = message.split('.');
    const errorType = parts[parts.length - 1];
    const errorTypeMap: Record<string, string> = {
        required: 'Este campo es requerido',
        invalid: 'Valor invalido',
        invalidType: 'Tipo de dato invalido',
        min: 'El valor es demasiado corto',
        max: 'El valor es demasiado largo',
        pattern: 'El formato no es valido',
        email: 'Debe ser un email valido'
    };
    return errorTypeMap[errorType] || 'Campo invalido';
}
```

**Error handling flow** (lines 217-237):

1. Calls `createMutation.mutateAsync(payload)`
2. Catches error, parses `error.message` as JSON (expects Zod error format)
3. Calls `formatZodErrorMessage()` on each error message
4. Sets field errors via form provider and scrolls to first error

#### 3.4.3 EntityEditContent

**File**: `apps/admin/src/components/entity-pages/EntityEditContent.tsx`

- Does NOT have `formatZodErrorMessage()`
- Handles server errors differently (lines 89-134) by parsing raw `zodError.message` strings without translation
- Inconsistent with EntityCreateContent

#### 3.4.4 Form Field IDs and Nested Objects

Admin forms use **dot-notation field IDs** for nested objects:

- Flat: `name`, `slug`, `address`
- Nested: `socialNetworks.facebook`, `price.basePrice`, `location.country`

**Value resolution** (`EntityFormSection.tsx`, lines 114-120):

```typescript
const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
};
```

**Data transformation** (`unflatten-values.utils.ts`):

- `prepareFormValues()`: API nested object -> flat form values (dot-notation keys)
- `unflattenValues()`: Flat form values -> API nested object

**Zod path mapping**: Zod validation paths map directly to field IDs:

- Zod path `['price', 'basePrice']` -> Field ID `'price.basePrice'`
- Zod path `['socialNetworks', 'facebook']` -> Field ID `'socialNetworks.facebook'`
- Zod path `['name']` -> Field ID `'name'`

This means `validateFieldWithZod` can join Zod error paths with `.` to get field IDs.

### 3.5 i18n System

**File**: `packages/i18n/src/config.ts`

**Architecture**: Custom lightweight implementation using JSON files + React hooks. Does NOT use i18next or any translation engine library. The only production dependency is `zod` (for schema validation). Peer dependency: `react >= 18.2.0`.

**Key characteristics**:

- **34 namespaces** currently registered (24 web/core + 10 admin)
- **Static imports**: All translation files are imported at build time (no lazy loading)
- **Key flattening**: Nested JSON becomes dot-notation keys with namespace prefix via `flattenObject()`
- **React hook**: `useTranslations(locale)` returns `{ t, tPlural, locale }`
- **Missing key handling**: Returns `"[MISSING: key]"` if key not found
- **Fallback**: Falls back to English locale if key missing in requested locale
- **Placeholder patterns**: Supports both `{{key}}` and `{key}` interpolation
- **Type generation**: `packages/i18n/scripts/generate-types.ts` generates `TranslationKey` union type (~4,120 keys currently)
- **Spanish translations**: Use accented characters (e.g., `"obligatorio"`, `"invalido"`)

**Exports from `packages/i18n/src/index.ts`**:

- Config: `defaultLocale`, `defaultIntlLocale`, `locales`, `namespaces`, `trans`
- Types: `Locale`, `Namespace`, `TranslationKey`, `TranslationKeys`
- Hook: `useTranslations`
- Utilities: `pluralize`, `formatDate`, `formatNumber`, `formatCurrency`, `resolveDefaultCurrency`, `toBcp47Locale`

#### 3.5.1 Scattered Validation Translations (Existing)

Validation-related translations already exist scattered across namespaces:

**`error.json`**:

- `form.validation-failed` - "La validacion del formulario fallo..."
- `form.validation-failed-fields` / `form.validation-failed-field`
- `field.required` - "{{field}} es requerido"
- `field.required-generic` - "Este campo es requerido"

**`admin-common.json`**:

- `validatedForm.validationErrors` - "Errores de validacion del formulario"
- `validatedForm.fixErrorsBeforeSubmitting` - "Por favor, corrija los errores..."
- `validatedForm.errorCount_one` / `validatedForm.errorCount_other`
- `states.invalidPrice`, `states.invalidGallery`

**Decision**: These existing keys are NOT consolidated into the new `validation` namespace. They serve different purposes (UI messages vs schema validation). Components that use them continue using them unchanged. The new `validation` namespace exclusively maps `zodError.*` schema keys.

### 3.6 Schema Patterns (Create vs Update)

All entities follow a consistent CRUD schema pattern:

- **Create schemas**: Omit auto-generated fields (`id`, `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById`). Required fields remain required.
- **Update schemas**: Same omits + `.partial()` applied. ALL fields become optional.
- **Naming**: `{Entity}CreateInputSchema`, `{Entity}UpdateInputSchema`
- **Import**: All from `@repo/schemas` (barrel export)

This means the schema registry (Task 3.1) needs to handle both modes: Create (full validation) and Update (partial validation, all fields optional).

### 3.7 ValidatedForm.tsx (Excluded)

**File**: `apps/admin/src/components/forms/ValidatedForm.tsx`

This is a separate generic form component with cross-field validation rules support (`useCrossFieldValidation` hook). It is NOT used by the entity CRUD pages, which use `EntityFormProvider` + `EntityCreateContent`/`EntityEditContent`.

**Why excluded**: Different component hierarchy. ValidatedForm uses its own validation system with `CrossFieldRule<TFormData>` and renders `admin-common.validatedForm.*` i18n keys. The entity form system is separate. No changes needed.

### 3.8 .refine() with Plain English Messages (Documented for Future)

Only **5 `.refine()` calls** across the entire `packages/schemas/src/` use plain English messages instead of `zodError.*` keys:

| File | Line | Message | Purpose |
|------|------|---------|---------|
| `utils/http-schema.factory.ts` | 147 | `"Page must be between 1 and 1000"` | Pagination range |
| `utils/http-schema.factory.ts` | 155 | `"Page size must be between 1 and 100"` | Pagination range |
| `entities/post/subtypes/post.filters.schema.ts` | 94 | `"Either id or slug must be provided"` | Conditional requirement |
| `entities/post/subtypes/post.filters.schema.ts` | 109 | `"Either id or slug must be provided"` | Conditional requirement |
| `entities/userBookmark/userBookmark.http.schema.ts` | 98 | `"At least one entity must be bookmarked"` | Conditional requirement |

**Note**: 5 other `.refine()` calls already use proper `zodError.*` keys. Zero `.superRefine()` calls exist in the codebase.

**Decision**: Out of scope for this spec. These 5 calls are server-side validations that don't surface to admin forms. A follow-up task can add `zodError.*` keys for them. Documented here for easy future reference.

## 4. Architecture Design

### 4.1 Error Flow Diagram

```
ADMIN CLIENT-SIDE VALIDATION:
  Form submit/blur
    -> Zod schema.safeParse(formData)
    -> ZodError.issues[]
    -> issue.path.join('.') -> fieldId (e.g., 'price.basePrice')
    -> issue.message -> zodError key (e.g., 'zodError.amenity.name.min')
    -> resolveValidationMessage({ key, t })
    -> t('validation.amenity.name.min')
    -> "El nombre debe tener al menos 2 caracteres"
    -> Display in form field

API SERVER-SIDE VALIDATION:
  Request arrives
    -> @hono/zod-openapi validates request
    -> Validation fails
    -> defaultHook(result, c) fires
    -> transformZodError(result.error) creates ValidationErrorResponse
    -> Return standard envelope { success: false, error: { code, message, details } }
    -> Admin receives 400 response
    -> Parse error.details.details[] array
    -> For each detail: resolveValidationMessage({ key: detail.translatedMessage, t })
    -> Display translated messages in form fields
```

### 4.2 i18n Namespace Structure

New namespace: `validation`

File: `packages/i18n/src/locales/es/validation.json`

Structure (nested JSON, flattened at build time):

```json
{
    "amenity": {
        "name": {
            "required": "El nombre es obligatorio",
            "min": "El nombre debe tener al menos {{min}} caracteres",
            "max": "El nombre no puede superar los {{max}} caracteres"
        },
        "displayWeight": {
            "required": "El peso de visualizacion es obligatorio",
            "invalidType": "El peso de visualizacion debe ser un numero",
            "int": "El peso de visualizacion debe ser un numero entero"
        }
    },
    "common": {
        "id": {
            "invalidUuid": "El ID debe ser un UUID valido",
            "invalid_uuid": "El ID debe ser un UUID valido"
        },
        "pagination": {
            "page": {
                "min_value": "La pagina debe ser al menos {{min}}"
            }
        }
    },
    "field": {
        "tooSmall": "El valor es demasiado corto",
        "tooLarge": "El valor es demasiado largo",
        "invalidType": "Tipo de dato invalido"
    }
}
```

After flattening: `validation.amenity.name.required` -> "El nombre es obligatorio"

**Key mapping rule**: Strip `zodError.` prefix, prepend `validation.` namespace:

- `zodError.amenity.name.min` -> `validation.amenity.name.min`
- `zodError.common.id.invalid_uuid` -> `validation.common.id.invalid_uuid`
- `validationError.field.tooSmall` -> `validation.field.tooSmall`

### 4.3 Translation Patterns by Validation Type

When generating Spanish translations for Task 1.2, follow these patterns consistently:

| Validation Type | Pattern | Example Key | Example Translation |
|----------------|---------|-------------|---------------------|
| `required` | "El/La {campo} es obligatorio/a" | `amenity.name.required` | "El nombre es obligatorio" |
| `min` (string) | "{campo} debe tener al menos {{min}} caracteres" | `amenity.name.min` | "El nombre debe tener al menos {{min}} caracteres" |
| `max` (string) | "{campo} no puede superar los {{max}} caracteres" | `amenity.name.max` | "El nombre no puede superar los {{max}} caracteres" |
| `min` (number) | "{campo} debe ser al menos {{min}}" | `admin.search.page.positive` | "La pagina debe ser al menos 1" |
| `max` (number) | "{campo} no puede ser mayor a {{max}}" | `admin.search.pageSize.max` | "El tamano de pagina no puede ser mayor a {{max}}" |
| `invalidType` | "{campo} debe ser un/una {tipo}" | `user.age.invalidType` | "La edad debe ser un numero" |
| `int` | "{campo} debe ser un numero entero" | `amenity.displayWeight.int` | "El peso de visualizacion debe ser un numero entero" |
| `uuid` | "{campo} debe ser un UUID valido" | `common.id.invalidUuid` | "El ID debe ser un UUID valido" |
| `enum` | "{campo} debe ser uno de los valores permitidos" | `enums.status.enum` | "El estado debe ser uno de los valores permitidos" |
| `pattern` | "El formato de {campo} no es valido" | `feature.slug.pattern` | "El formato del slug no es valido" |
| `positive` | "{campo} debe ser un numero positivo" | `exchangeRate.rate.positive` | "La tasa debe ser un numero positivo" |
| `format` | "El formato de {campo} no es valido" | `common.email.format` | "El formato del email no es valido" |
| `invalid` | "{campo} no es valido" | `user.email.invalid` | "El email no es valido" |
| `invalidUrl` | "{campo} debe ser una URL valida" | `common.url.invalidUrl` | "La URL no es valida" |
| `tooLow` | "{campo} es demasiado bajo" | `common.minPrice.tooLow` | "El precio minimo es demasiado bajo" |
| `tooHigh` | "{campo} es demasiado alto" | `common.maxPrice.tooHigh` | "El precio maximo es demasiado alto" |

**Interpolation parameters**: Use `{{min}}`, `{{max}}`, `{{expected}}`, `{{received}}` placeholders. These are populated by `transformZodError()` params extraction (min, max from `too_small`/`too_large` issues) and by `resolveValidationMessage()` params argument.

**Gender agreement**: Default to masculine ("obligatorio", "invalido"). For known feminine nouns (url, fecha, descripcion, imagen, contrasena, ubicacion, categoria, tasa), use feminine forms.

### 4.4 Key Resolution Helper

**Type compatibility note**: The `useTranslations()` hook returns `t: (key: TranslationKey, params?) => string` where `TranslationKey` is a union of all known keys. However, `resolveValidationMessage` constructs keys dynamically at runtime (e.g., `validation.${...}`). To solve this type mismatch, this function accepts a generic `t` typed as `(key: string, params?) => string`. Callers must cast: `t as (key: string, params?: Record<string, unknown>) => string`.

```typescript
/**
 * Resolves a zodError or validationError key to a translated message.
 *
 * Mapping rules:
 * - 'zodError.amenity.name.min' -> t('validation.amenity.name.min', params)
 * - 'validationError.field.tooSmall' -> t('validation.field.tooSmall', params)
 * - Other keys -> t(key, params) as-is
 *
 * Fallback: if translation returns '[MISSING: ...]', returns the original key.
 *
 * @example
 * const { t } = useTranslations();
 * const tAny = t as (key: string, params?: Record<string, unknown>) => string;
 *
 * resolveValidationMessage({
 *   key: 'zodError.amenity.name.min',
 *   t: tAny,
 *   params: { min: 2 }
 * })
 * // Returns: "El nombre debe tener al menos 2 caracteres"
 */
export function resolveValidationMessage({
    key,
    t,
    params
}: {
    readonly key: string;
    readonly t: (key: string, params?: Record<string, unknown>) => string;
    readonly params?: Record<string, unknown>;
}): string {
    let i18nKey: string;

    if (key.startsWith('zodError.')) {
        i18nKey = `validation.${key.slice('zodError.'.length)}`;
    } else if (key.startsWith('validationError.')) {
        i18nKey = `validation.${key.slice('validationError.'.length)}`;
    } else {
        i18nKey = key;
    }

    const translated = t(i18nKey, params);

    if (translated.startsWith('[MISSING:')) {
        return key;
    }

    return translated;
}
```

### 4.5 defaultHook Implementation

The `defaultHook` in `@hono/zod-openapi` receives:

```typescript
type Hook = (
    result: { target: keyof ValidationTargets } & (
        | { success: true; data: unknown }
        | { success: false; error: ZodError }
    ),
    c: Context
) => Response | Promise<Response> | void
```

**Behavior**:

- `target`: Which part was validated: `'json'`, `'query'`, `'param'`, `'header'`, `'cookie'`, `'form'`
- When `result.success === true`: Hook should return `undefined` (continue to route handler)
- When `result.success === false`: Hook should return an error response
- `defaultHook` is used ONLY when no per-route hook is specified. If a route passes a hook as the third argument to `app.openapi()`, that hook completely replaces `defaultHook` for that route. They do NOT both execute.

**Implementation for `createRouter()`**:

```typescript
export function createRouter() {
    return new OpenAPIHono<AppBindings>({
        strict: false,
        defaultHook: (result, c) => {
            if (result.success) {
                return;
            }

            const transformedError = transformZodError(result.error);

            return c.json(
                {
                    success: false,
                    error: {
                        code: transformedError.code,
                        message: transformedError.message,
                        details: transformedError
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: c.get('requestId') || 'unknown'
                    }
                },
                400
            );
        }
    });
}
```

**Import needed**: `import { transformZodError } from './zod-error-transformer';`

### 4.6 Client-Side Zod Issue Params Extraction

On the server side, `transformZodError()` in `zod-error-transformer.ts` already extracts params (min, max, etc.) from Zod issues via `extractErrorParams()`. On the client side (admin forms), a similar helper is needed to extract interpolation params from `ZodIssue` objects so that translations like `"debe tener al menos {{min}} caracteres"` resolve correctly.

```typescript
import type { ZodIssue } from 'zod';

/**
 * Extracts interpolation parameters from a ZodIssue for use in translation strings.
 *
 * Maps Zod issue properties to the `{{param}}` placeholders used in validation.json:
 * - too_small issues: { min: issue.minimum }
 * - too_big issues: { max: issue.maximum }
 * - invalid_type issues: { expected: issue.expected, received: issue.received }
 * - invalid_literal issues: { expected: issue.expected }
 * - not_multiple_of issues: { multipleOf: issue.multipleOf }
 */
export function extractZodIssueParams(issue: ZodIssue): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if ('minimum' in issue) params.min = issue.minimum;
    if ('maximum' in issue) params.max = issue.maximum;
    if ('expected' in issue) params.expected = issue.expected;
    if ('received' in issue) params.received = issue.received;
    if ('multipleOf' in issue) params.multipleOf = issue.multipleOf;
    if ('options' in issue) params.options = (issue.options as unknown[])?.join(', ');

    return params;
}
```

This function is used inside `validateFormWithZod()` and `validateFieldWithZod()` (Task 3.2) when calling `resolveValidationMessage()`.

### 4.7 Why Not Zod v4 Native Locales

Zod v4 includes built-in locale support via `z.config(z.locales.es())` with 40+ languages including Spanish. This was considered but rejected for three reasons:

1. **Global state**: `z.config()` sets the locale globally for the entire Zod instance. In SSR/API contexts with concurrent requests, this creates race conditions (request A sets Spanish, request B sets English, request A gets English errors).
2. **Generic messages**: Native messages are generic (e.g., "Se esperaba un string, se recibio un numero") without field-specific context. The project's `zodError.*` keys provide domain-specific messages (e.g., "El nombre es obligatorio") which are much more user-friendly.
3. **No i18n integration**: Native locales don't integrate with the existing `@repo/i18n` system. Having two separate translation systems would create maintenance burden and inconsistency.

The chosen approach (translation JSON in `@repo/i18n` + `resolveValidationMessage()` helper) integrates with the existing system and provides field-specific, contextual messages.

### 4.8 ZodSchema Type Compatibility Note

The project uses Zod v4 (`^4.0.8`, resolves to 4.0.17). In Zod v4, `ZodSchema` is available as a type alias for `ZodType` through the v4 classic compatibility layer. The codebase already uses `import type { ZodSchema } from 'zod'` in `packages/schemas/src/utils/openapi.utils.ts`, confirming it compiles. Use `ZodSchema` in this spec for consistency with existing code.

### 4.9 Double Namespace Key Note

Keys from `apps/api/src/types/validation-messages.ts` like `zodError.validation.content_type.invalid` produce a double `validation.` prefix when mapped:

- `zodError.validation.content_type.invalid` -> strip `zodError.` -> `validation.content_type.invalid` -> prepend namespace -> `validation.validation.content_type.invalid`

This is correct and expected. The `validation.json` file must include a nested `"validation"` object:

```json
{
    "validation": {
        "content_type": {
            "invalid": "El tipo de contenido no es valido"
        }
    }
}
```

After flattening, this produces the key `validation.validation.content_type.invalid` which `resolveValidationMessage()` will look up correctly.

## 5. Schema Registry Reference

Complete mapping of entity types to schemas for Task 3.1:

| Entity Type Key | Create Schema | Update Schema | Import |
|----------------|---------------|---------------|--------|
| `accommodation` | `AccommodationCreateInputSchema` | `AccommodationUpdateInputSchema` | `@repo/schemas` |
| `amenity` | `AmenityCreateInputSchema` | `AmenityUpdateInputSchema` | `@repo/schemas` |
| `feature` | `FeatureCreateInputSchema` | `FeatureUpdateInputSchema` | `@repo/schemas` |
| `attraction` | `AttractionCreateInputSchema` | `AttractionUpdateInputSchema` | `@repo/schemas` |
| `destination` | `DestinationCreateInputSchema` | `DestinationUpdateInputSchema` | `@repo/schemas` |
| `event` | `EventCreateInputSchema` | `EventUpdateInputSchema` | `@repo/schemas` |
| `eventLocation` | `EventLocationCreateInputSchema` | `EventLocationUpdateInputSchema` | `@repo/schemas` |
| `eventOrganizer` | `EventOrganizerCreateInputSchema` | `EventOrganizerUpdateInputSchema` | `@repo/schemas` |
| `post` | `PostCreateInputSchema` | `PostUpdateInputSchema` | `@repo/schemas` |
| `sponsor` | `PostSponsorCreateInputSchema` | `PostSponsorUpdateInputSchema` | `@repo/schemas` |
| `tag` | `TagCreateInputSchema` | `TagUpdateInputSchema` | `@repo/schemas` |
| `user` | `UserCreateInputSchema` | `UserUpdateInputSchema` | `@repo/schemas` |

**Mode handling**:

- `getEntitySchema({ entityType: 'accommodation', mode: 'create' })` returns `AccommodationCreateInputSchema`
- `getEntitySchema({ entityType: 'accommodation', mode: 'edit' })` returns `AccommodationUpdateInputSchema`

**Note**: Update schemas apply `.partial()`, making all fields optional. This means field-level validation on blur for edit forms will only report errors for fields that have values (empty/missing fields are valid in update mode).

## 6. Implementation Phases

### Phase 0: API Validation Response Fix

**Task 0.1**: Add defaultHook to createRouter

- **File**: `apps/api/src/utils/create-app.ts`
- **Change**: Add `defaultHook` to `OpenAPIHono` constructor options (see section 4.5 for exact implementation)
- **Import**: Add `import { transformZodError } from './zod-error-transformer';`
- **Verify**: Check if `createApp()` also creates an `OpenAPIHono` instance that needs the hook (it does for the root app). If so, add it there too. If `createApp()` delegates to `createRouter()`, only one change needed.
- **Interaction with middleware**: The existing `validation.ts` middleware handles `manualZodSchema` separately. The `defaultHook` handles `@hono/zod-openapi` route-level validation. They do NOT conflict because they operate at different stages.

**Task 0.2**: Add tests for defaultHook validation

- **File**: `apps/api/test/utils/create-app.test.ts` (new)
- **Test cases**:
  1. Route with invalid request body returns HTTP 400 with standard envelope
  2. Response has `success: false`
  3. Response has `error.code === 'VALIDATION_ERROR'`
  4. Response has `error.details.details[]` array with field-level info
  5. Response has `error.details.summary` with error counts
  6. Valid request still returns expected success response
  7. Route with per-route hook uses that hook instead of defaultHook

**Task 0.3**: Verify with existing admin route

- Send invalid request to an existing admin route (e.g., POST `/api/v1/admin/amenities` with empty body)
- Confirm HTTP 400 with standard envelope format
- Confirm existing passing requests still work

### Phase 1: i18n Infrastructure

**Task 1.1**: Extract complete key inventory

- **Script**: `scripts/extract-zod-keys.ts`
- **Scan scope**: ALL of these directories/files:
  - `packages/schemas/src/**/*.ts`
  - `apps/api/src/types/validation-messages.ts`
  - `apps/api/src/schemas/base-schemas.ts`
  - `apps/api/src/routes/exchange-rates/admin/index.ts`
- **Extraction logic**:
  1. Use regex to find all `zodError.{...}` string literals
  2. For template literals in `http-field.factory.ts`: Scan call sites to enumerate field names. Known fields: `minPrice`, `maxPrice`, `minGuests`, `maxGuests`, `latitude`, `longitude`, `checkIn`, `checkOut`, `isActive`, `isFeatured`, `distance`
  3. For template literals: Resolve each `${variable}` by tracing the call context. If unresolvable, output as `zodError.common.{DYNAMIC_FIELD}.validation` with a warning
- **Output**: `scripts/zod-keys-inventory.json` with structure:

  ```json
  {
      "keys": ["zodError.accommodation.name.required", "..."],
      "total": 1037,
      "byNamespace": { "accommodation": 35, "amenity": 50, "..." : "..." },
      "dynamicKeys": ["zodError.common.minPrice.tooLow", "..."],
      "warnings": ["Unresolved template: ..."]
  }
  ```

**Task 1.2**: Generate Spanish translations JSON

- **File**: `packages/i18n/src/locales/es/validation.json`
- **Source**: Use `scripts/zod-keys-inventory.json` from Task 1.1
- **Process**:
  1. For each key, strip `zodError.` prefix to get the JSON path
  2. Apply the translation pattern from section 4.3 based on the validation type (last segment of the key)
  3. For field names, use the Spanish equivalent (e.g., `name` -> "nombre", `email` -> "email", `slug` -> "slug", `displayWeight` -> "peso de visualizacion")
  4. For numeric constraints, use `{{min}}` and `{{max}}` interpolation placeholders
  5. Include BOTH camelCase and underscore variants for the keys from `base-schemas.ts`
- **Size**: ~1,500-2,000 lines
- **Validation**: After generation, verify every key in the inventory has a corresponding translation entry

**Task 1.3**: Create placeholder EN/PT files

- **Files**: `packages/i18n/src/locales/en/validation.json` and `pt/validation.json`
- **Content**: Same nested structure as ES file
- **Values**: Prefix with `[EN]` or `[PT]` respectively (e.g., `"[EN] Name is required"`, `"[PT] O nome e obrigatorio"`)
- **Purpose**: Prevent `[MISSING: ...]` errors for non-ES locales

**Task 1.4**: Register namespace in i18n config

- **File**: `packages/i18n/src/config.ts`
- **Changes**:
  1. Add `'validation'` to `namespaces` array (line ~55, after existing entries)
  2. Add 3 static imports (one per locale):

     ```typescript
     import validationEs from './locales/es/validation.json';
     import validationEn from './locales/en/validation.json';
     import validationPt from './locales/pt/validation.json';
     ```

  3. Add to `rawTranslations` object under each locale:

     ```typescript
     es: { ..., validation: validationEs },
     en: { ..., validation: validationEn },
     pt: { ..., validation: validationPt },
     ```

**Task 1.5**: Create resolveValidationMessage helper

- **File**: `packages/i18n/src/utils/resolve-validation-message.ts`
- **Create**: `src/utils/` directory if it doesn't exist
- **Implementation**: Per section 4.4
- **Export**: Add to `packages/i18n/src/index.ts`:

  ```typescript
  export { resolveValidationMessage } from './utils/resolve-validation-message';
  ```

**Task 1.6**: Regenerate i18n types

- **Command**: `cd packages/i18n && pnpm generate-types`
- **Verify**: `TranslationKey` union in `packages/i18n/src/types.ts` now includes `validation.*` keys
- **Note**: File will grow significantly (~1,037 new keys). This is expected.

**Task 1.7**: Add tests for resolveValidationMessage

- **File**: `packages/i18n/test/utils/resolve-validation-message.test.ts`
- **Test cases**:
  1. `zodError.amenity.name.min` -> calls `t('validation.amenity.name.min')`
  2. `validationError.field.tooSmall` -> calls `t('validation.field.tooSmall')`
  3. Arbitrary key without prefix -> calls `t(key)` as-is
  4. Params interpolation -> passes params to `t()`
  5. Missing translation fallback -> returns original key when `t()` returns `[MISSING: ...]`
  6. Empty string key -> returns empty string
  7. Key with underscore naming -> `zodError.common.id.invalid_uuid` -> calls `t('validation.common.id.invalid_uuid')`

### Phase 2: Unify Error Systems

**Task 2.1**: Update transformZodError to prefer schema message keys

- **File**: `apps/api/src/utils/zod-error-transformer.ts`
- **Change**: When building `TransformedValidationError`, check if `err.message` starts with `zodError.`:
  - If yes: Use `err.message` as the `message` field (the primary translation key)
  - If no: Fall back to generic key from `ZOD_ERROR_MESSAGE_MAP`
- **Current behavior**: `message` always comes from `ZOD_ERROR_MESSAGE_MAP`, `translatedMessage` has the schema key
- **New behavior**: If schema provides a `zodError.*` key, use it as `message` (this is the key that `resolveValidationMessage()` will translate)
- **Backward compatible**: Routes not using `zodError.*` messages still get generic keys

**Task 2.2**: Add generic validation keys to validation.json

- **File**: `packages/i18n/src/locales/es/validation.json`
- **Add**: 23 generic keys under `field` namespace, mapping from `ZOD_ERROR_MESSAGE_MAP` values:

  ```json
  {
      "field": {
          "tooSmall": "El valor es demasiado corto",
          "tooLarge": "El valor es demasiado largo",
          "invalidType": "Tipo de dato invalido",
          "required": "Este campo es requerido",
          "invalidEnum": "Valor no permitido",
          "invalidEmail": "Debe ser un email valido",
          "invalidUrl": "Debe ser una URL valida",
          "invalidUuid": "Debe ser un UUID valido",
          "invalidDate": "Debe ser una fecha valida",
          "invalidString": "Debe ser un texto valido",
          "invalidNumber": "Debe ser un numero valido",
          "tooSmallNumber": "El numero es demasiado bajo",
          "tooLargeNumber": "El numero es demasiado alto",
          "tooSmallArray": "Se requieren mas elementos",
          "tooLargeArray": "Demasiados elementos",
          "invalidUnion": "El valor no coincide con ninguno de los formatos permitidos",
          "unrecognizedKeys": "Se encontraron campos no reconocidos",
          "custom": "Error de validacion personalizado",
          "invalidFormat": "Formato invalido",
          "notMultipleOf": "El valor debe ser multiplo de {{multipleOf}}",
          "invalidLiteral": "Se esperaba el valor {{expected}}",
          "invalidArguments": "Argumentos invalidos",
          "invalidReturnType": "Tipo de retorno invalido"
      }
  }
  ```

- **Also add** to EN/PT placeholder files with `[EN]`/`[PT]` prefix

**Task 2.3**: Update transformer tests

- **File**: `apps/api/test/utils/zod-error-transformer.test.ts`
- **Add tests**:
  1. When Zod error has `zodError.*` message, it appears as `message` field
  2. When Zod error has no `zodError.*` message, falls back to `ZOD_ERROR_MESSAGE_MAP` generic key
  3. Existing tests continue passing

### Phase 3: Admin Zod Integration

**Pre-requisites verification** (developer MUST check before starting):

1. Verify each entity's form field IDs match the schema property names
2. Verify all 12 schemas are exported from `@repo/schemas` barrel
3. Run `pnpm typecheck` in `packages/schemas` to confirm schemas compile

**Task 3.1**: Create schema registry

- **File**: `apps/admin/src/lib/validation/schema-registry.ts`
- **Implementation**: Registry mapping entity types to create/update schemas (see section 5 for complete table)
- **Function signature**:

  ```typescript
  import type { ZodSchema } from 'zod';

  type EntityType = 'accommodation' | 'amenity' | 'feature' | 'attraction' | 'destination' | 'event' | 'eventLocation' | 'eventOrganizer' | 'post' | 'sponsor' | 'tag' | 'user';
  type FormMode = 'create' | 'edit';

  export function getEntitySchema({ entityType, mode }: {
      readonly entityType: EntityType;
      readonly mode: FormMode;
  }): ZodSchema | undefined;
  ```

- **Return**: The Zod schema object, or `undefined` for unknown entity types
- **Note**: Import all 24 schemas (12 create + 12 update) from `@repo/schemas`

**Task 3.2**: Create Zod validation helpers

- **File**: `apps/admin/src/lib/validation/validate-form.ts`
- **Functions**:

  ```typescript
  import type { ZodSchema, ZodIssue } from 'zod';
  import { resolveValidationMessage } from '@repo/i18n';
  import { unflattenValues } from '../../components/entity-form/utils/unflatten-values.utils';

  /**
   * Extracts interpolation parameters from a ZodIssue for translation strings.
   * Maps Zod issue properties to {{param}} placeholders in validation.json.
   */
  export function extractZodIssueParams(issue: ZodIssue): Record<string, unknown> {
      const params: Record<string, unknown> = {};

      if ('minimum' in issue) params.min = (issue as Record<string, unknown>).minimum;
      if ('maximum' in issue) params.max = (issue as Record<string, unknown>).maximum;
      if ('expected' in issue) params.expected = (issue as Record<string, unknown>).expected;
      if ('received' in issue) params.received = (issue as Record<string, unknown>).received;
      if ('multipleOf' in issue) params.multipleOf = (issue as Record<string, unknown>).multipleOf;

      return params;
  }

  /**
   * Validates entire form data against a Zod schema.
   * Returns a map of fieldId -> translated error message.
   *
   * Flow:
   * 1. Unflatten dot-notation form values to nested objects
   * 2. Run schema.safeParse() on the nested data
   * 3. For each issue: extract params, resolve translated message
   * 4. Return map of fieldId -> translated error string
   */
  export function validateFormWithZod({
      schema,
      data,
      t
  }: {
      readonly schema: ZodSchema;
      readonly data: Record<string, unknown>;
      readonly t: (key: string, params?: Record<string, unknown>) => string;
  }): Record<string, string> {
      const nestedData = unflattenValues(data);
      const result = schema.safeParse(nestedData);

      if (result.success) return {};

      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
          const fieldId = issue.path.join('.');
          if (fieldId && !errors[fieldId]) {
              const params = extractZodIssueParams(issue);
              errors[fieldId] = resolveValidationMessage({
                  key: issue.message,
                  t,
                  params
              });
          }
      }
      return errors;
  }

  /**
   * Validates a single field by running the full schema validation
   * and extracting only the error for the target field.
   * This ensures cross-field validations still work correctly.
   */
  export function validateFieldWithZod({
      schema,
      data,
      fieldId,
      t
  }: {
      readonly schema: ZodSchema;
      readonly data: Record<string, unknown>;
      readonly fieldId: string;
      readonly t: (key: string, params?: Record<string, unknown>) => string;
  }): string | undefined {
      const nestedData = unflattenValues(data);
      const result = schema.safeParse(nestedData);

      if (result.success) return undefined;

      const fieldPath = fieldId.split('.');
      const issue = result.error.issues.find((iss) =>
          iss.path.length === fieldPath.length &&
          iss.path.every((segment, i) => String(segment) === fieldPath[i])
      );

      if (!issue) return undefined;

      const params = extractZodIssueParams(issue);
      return resolveValidationMessage({ key: issue.message, t, params });
  }
  ```

- **Path-to-fieldId mapping**: Join Zod error `path` array with `.` to get field ID:

  ```typescript
  const fieldId = issue.path.join('.');
  // ['price', 'basePrice'] -> 'price.basePrice'
  // ['name'] -> 'name'
  ```

- **Params extraction**: `extractZodIssueParams(issue)` extracts `min`, `max`, `expected`, `received`, `multipleOf` from the issue so that translations like `"debe tener al menos {{min}} caracteres"` interpolate correctly (see section 4.6)
- **Type cast for `t`**: Callers must cast the `t` from `useTranslations()`: `t as (key: string, params?: Record<string, unknown>) => string` (see section 4.4 type compatibility note)
- **Data preparation**: `unflattenValues()` is called internally to convert dot-notation form values to nested objects before `safeParse()`

**Task 3.3**: Integrate Zod validation into EntityFormProvider

- **File**: `apps/admin/src/components/entity-form/providers/EntityFormProvider.tsx`
- **Changes**:
  1. Accept optional `zodSchema` prop: `zodSchema?: ZodSchema`
  2. Get `t` from `useTranslations()` hook (import from `@repo/i18n`). Cast for validation helpers: `const tAny = t as (key: string, params?: Record<string, unknown>) => string;`
  3. In `validateForm()` (line 142):
     - If `zodSchema` is provided: call `validateFormWithZod({ schema: zodSchema, data: formValues, t: tAny })`
     - If not: fall back to existing required-field check (backward compatible)
     - Return type: `Record<string, string>` (empty object = valid)
  4. In `validateField()` (line 221):
     - If `zodSchema` is provided: call `validateFieldWithZod({ schema: zodSchema, data: formValues, fieldId, t: tAny })`
     - If not: return `undefined` (current behavior)
  5. **Wire validation into submit flow** (`handleSave()`, line 174):
     - Call `validateForm()` BEFORE calling the save handler
     - If errors exist: call `setErrors(errors)`, show toast, scroll to first error, and return early (do NOT call save handler)
     - If no errors: proceed to save handler as before
     - Apply the same pattern to `handleSaveAndPublish()` (line 190)
  6. Remove all four TODO comments (lines 60, 151, 199, 221)

**Task 3.4**: Pass zodSchema from entity pages

- **EntityCreateContent**: Accept optional `zodSchema` prop, pass through to `EntityFormProvider`
- **EntityEditContent**: Accept optional `zodSchema` prop, pass through to `EntityFormProvider`
- **12 create pages**: Each page imports its entity's Create schema and passes it:

  ```typescript
  import { AccommodationCreateInputSchema } from '@repo/schemas';
  // ...
  <EntityCreateContent
      config={config}
      zodSchema={AccommodationCreateInputSchema}
      // ... other props
  />
  ```

- **12 edit pages**: Same pattern with Update schema:

  ```typescript
  import { AccommodationUpdateInputSchema } from '@repo/schemas';
  // ...
  <EntityEditContent
      config={config}
      zodSchema={AccommodationUpdateInputSchema}
      // ... other props
  />
  ```

**Files to update** (24 total):

Create pages:

1. `apps/admin/src/routes/_authed/accommodations/new.tsx`
2. `apps/admin/src/routes/_authed/content/accommodation-amenities/new.tsx`
3. `apps/admin/src/routes/_authed/content/accommodation-features/new.tsx`
4. `apps/admin/src/routes/_authed/destinations/new.tsx`
5. `apps/admin/src/routes/_authed/content/destination-attractions/new.tsx`
6. `apps/admin/src/routes/_authed/events/new.tsx`
7. `apps/admin/src/routes/_authed/events/locations/new.tsx`
8. `apps/admin/src/routes/_authed/events/organizers/new.tsx`
9. `apps/admin/src/routes/_authed/posts/new.tsx`
10. `apps/admin/src/routes/_authed/sponsors/new.tsx`
11. `apps/admin/src/routes/_authed/settings/tags/new.tsx`
12. `apps/admin/src/routes/_authed/access/users/new.tsx`

Edit pages:

1. `apps/admin/src/routes/_authed/accommodations/$id_.edit.tsx`
2. `apps/admin/src/routes/_authed/content/accommodation-amenities/$id_.edit.tsx`
3. `apps/admin/src/routes/_authed/content/accommodation-features/$id_.edit.tsx`
4. `apps/admin/src/routes/_authed/destinations/$id_.edit.tsx`
5. `apps/admin/src/routes/_authed/content/destination-attractions/$id_.edit.tsx`
6. `apps/admin/src/routes/_authed/events/$id_.edit.tsx`
7. `apps/admin/src/routes/_authed/events/locations/$id_.edit.tsx`
8. `apps/admin/src/routes/_authed/events/organizers/$id_.edit.tsx`
9. `apps/admin/src/routes/_authed/posts/$id_.edit.tsx`
10. `apps/admin/src/routes/_authed/sponsors/$id_.edit.tsx`
11. `apps/admin/src/routes/_authed/settings/tags/$id_.edit.tsx`
12. `apps/admin/src/routes/_authed/access/users/$id_.edit.tsx`

**Task 3.5**: Wire up onBlur validation

- **Verified**: `EntityFormSection.tsx` line 147 already passes `onBlur: () => onFieldBlur(field.id)` to field components
- **Verified**: `EntityFormProvider.tsx` line 97 calls `validateField(fieldId)` inside the blur handler
- No changes needed for wiring.. the `validateField()` function is already called on blur, it just currently returns `undefined`. Task 3.3 makes it return real Zod errors.
- **Important behavior in edit mode**: Update schemas use `.partial()`, so empty/missing fields are valid. A user clearing a field and tabbing out will NOT see an error in edit mode. This is correct behavior (partial updates allow omitting fields).
- **Verify by testing**: In CREATE mode, blur on a required empty field should show a translated validation error

**Task 3.6**: Handle server-side errors with i18n resolution

- **EntityCreateContent.tsx**:
  1. Remove `formatZodErrorMessage()` function entirely (lines 25-45)
  2. Import `resolveValidationMessage` from `@repo/i18n`
  3. Import `useTranslations` from `@repo/i18n`
  4. Cast `t` for validation: `const tAny = t as (key: string, params?: Record<string, unknown>) => string;`
  5. In the catch block (lines 217-237): Replace `formatZodErrorMessage(message)` with `resolveValidationMessage({ key: message, t: tAny })`
  6. Since Task 3.3 now wires `validateForm()` into `handleSave()` via EntityFormProvider, the EntityCreateContent `handleSave()` will only be called after client-side validation passes. Server-side errors are a second line of defense.

- **EntityEditContent.tsx**:
  1. Import `resolveValidationMessage` from `@repo/i18n`
  2. Import `useTranslations` from `@repo/i18n`
  3. Cast `t` for validation: `const tAny = t as (key: string, params?: Record<string, unknown>) => string;`
  4. In server error parsing (lines 89-134): Use `resolveValidationMessage({ key: errorMessage, t: tAny })` for error display

### Phase 4: Testing and Verification

**Task 4.1**: Unit tests for validateFormWithZod and extractZodIssueParams

- **File**: `apps/admin/test/lib/validation/validate-form.test.ts`
- **Test cases for validateFormWithZod**:
  1. Valid data returns empty error map
  2. Missing required field returns translated error for that field
  3. Multiple validation errors return multiple entries
  4. Nested field paths produce dot-notation field IDs (`price.basePrice`)
  5. Unknown/extra keys in data are ignored (`.passthrough()` behavior)
  6. `validateFieldWithZod` returns error only for target field
  7. `validateFieldWithZod` returns `undefined` when target field is valid
  8. Update schema (`.partial()`) allows missing fields
- **Test cases for extractZodIssueParams**:
  9. `too_small` issue extracts `{ min: <value> }`
  10. `too_big` issue extracts `{ max: <value> }`
  11. `invalid_type` issue extracts `{ expected, received }`
  12. Issue with no extra properties returns empty object
  13. Params are correctly interpolated in translated messages (end-to-end: schema -> issue -> params -> translation with `{{min}}`)

**Task 4.2**: Unit tests for schema registry

- **File**: `apps/admin/test/lib/validation/schema-registry.test.ts`
- **Test cases**:
  1. Each of 12 entity types returns a schema for `create` mode
  2. Each of 12 entity types returns a schema for `edit` mode
  3. Unknown entity type returns `undefined`
  4. Create schema requires mandatory fields (`.safeParse({})` fails)
  5. Edit schema allows empty object (`.safeParse({})` passes due to `.partial()`)

**Task 4.3**: Integration test - admin form validation

- **File**: `apps/admin/test/components/entity-form/zod-validation.test.ts`
- **Test cases**:
  1. Form with `zodSchema` validates on submit
  2. Form without `zodSchema` falls back to required-field check
  3. Blur validation triggers `validateFieldWithZod`
  4. Error messages are translated strings (not raw keys)
  5. Server errors are resolved through `resolveValidationMessage`

**Task 4.4**: Verify no regressions

- Run `pnpm typecheck` (all packages)
- Run `pnpm lint` (Biome)
- Run `pnpm test` (all tests)
- Run `pnpm build` (all apps)

**Task 4.5**: Manual verification checklist

- [ ] Create a new amenity with empty name -> see translated "El nombre es obligatorio"
- [ ] Edit an accommodation, clear the name, tab out -> see blur validation error
- [ ] Submit an invalid form -> see multiple translated errors
- [ ] Send invalid API request directly -> see standard envelope format
- [ ] Create a valid entity -> confirm no regressions
- [ ] Edit a valid entity -> confirm no regressions
- [ ] Check error messages use accented characters (e.g., "inválido" with tilde, not "invalido" without)

## 7. File Inventory

### Files to CREATE (12)

| File | Phase | Purpose |
|------|-------|---------|
| `packages/i18n/src/locales/es/validation.json` | 1 | Spanish translations (~1,037 entity-specific + 23 generic keys) |
| `packages/i18n/src/locales/en/validation.json` | 1 | English placeholders |
| `packages/i18n/src/locales/pt/validation.json` | 1 | Portuguese placeholders |
| `packages/i18n/src/utils/resolve-validation-message.ts` | 1 | Key resolution helper |
| `packages/i18n/test/utils/resolve-validation-message.test.ts` | 1 | Tests for helper |
| `scripts/extract-zod-keys.ts` | 1 | Key extraction script |
| `apps/admin/src/lib/validation/schema-registry.ts` | 3 | Entity-to-schema mapping (12 entities) |
| `apps/admin/src/lib/validation/validate-form.ts` | 3 | Zod form validation helpers |
| `apps/admin/test/lib/validation/validate-form.test.ts` | 4 | Tests |
| `apps/admin/test/lib/validation/schema-registry.test.ts` | 4 | Tests |
| `apps/admin/test/components/entity-form/zod-validation.test.ts` | 4 | Integration tests |
| `apps/api/test/utils/create-app.test.ts` | 0 | defaultHook validation tests |

### Files to MODIFY (28)

| File | Phase | Changes |
|------|-------|---------|
| `apps/api/src/utils/create-app.ts` | 0 | Add `defaultHook` to `createRouter()` + import `transformZodError` |
| `packages/i18n/src/config.ts` | 1 | Register `validation` namespace (array + imports + rawTranslations) |
| `packages/i18n/src/index.ts` | 1 | Export `resolveValidationMessage` |
| `packages/i18n/src/types.ts` | 1 | Regenerated by script (auto) |
| `apps/api/src/utils/zod-error-transformer.ts` | 2 | Prefer schema message keys over generic MAP keys |
| `apps/api/test/utils/zod-error-transformer.test.ts` | 2 | Add tests for schema key preference |
| `apps/admin/src/components/entity-form/providers/EntityFormProvider.tsx` | 3 | Add Zod validation, remove TODOs |
| `apps/admin/src/components/entity-pages/EntityCreateContent.tsx` | 3 | Remove `formatZodErrorMessage()`, use `resolveValidationMessage` |
| `apps/admin/src/components/entity-pages/EntityEditContent.tsx` | 3 | Use `resolveValidationMessage` for error parsing |
| 12x `apps/admin/src/routes/_authed/*/new.tsx` | 3 | Pass `zodSchema` prop (see Task 3.4 for full list) |
| 12x `apps/admin/src/routes/_authed/*/$id_.edit.tsx` | 3 | Pass `zodSchema` prop (see Task 3.4 for full list) |

## 8. Acceptance Criteria

### Phase 0

- [ ] `createRouter()` has `defaultHook` that calls `transformZodError()`
- [ ] API returns HTTP 400 with standard envelope format `{ success, error: { code, message, details }, metadata }`
- [ ] Response `error.details` is a `ValidationErrorResponse` with `details[]` array and `summary`
- [ ] Valid requests still work normally (defaultHook returns `undefined` on success)
- [ ] Per-route hooks still override defaultHook (no interference)
- [ ] Test coverage for defaultHook (7+ test cases)
- [ ] Existing `zod-error-transformer.test.ts` tests still pass

### Phase 1

- [ ] `validation` namespace registered in `packages/i18n/src/config.ts` (namespace array + 3 imports + rawTranslations)
- [ ] All 3 locale files exist (ES complete, EN/PT with `[EN]`/`[PT]` prefixes)
- [ ] All ~1,037 zodError keys have ES translations in `validation.json`
- [ ] Underscore-named keys from `base-schemas.ts` and `validation-messages.ts` are included
- [ ] 23 generic `validation.field.*` keys translated
- [ ] Translations use `{{min}}`, `{{max}}` interpolation placeholders where appropriate
- [ ] Translations use accented characters per existing convention
- [ ] `resolveValidationMessage()` correctly maps `zodError.*` -> `validation.*`
- [ ] `resolveValidationMessage()` correctly maps `validationError.*` -> `validation.*`
- [ ] Helper has test coverage (7+ cases including underscore keys)
- [ ] `pnpm generate-types` succeeds in `packages/i18n`
- [ ] `pnpm typecheck` passes across all packages

### Phase 2

- [ ] `transformZodError()` uses `zodError.*` schema keys as `message` when present
- [ ] Generic fallback keys from `ZOD_ERROR_MESSAGE_MAP` still work when no schema key
- [ ] Existing transformer tests pass unchanged
- [ ] New tests cover schema key preference behavior

### Phase 3

- [ ] `EntityFormProvider` accepts optional `zodSchema` prop
- [ ] When `zodSchema` provided: validates on submit via `validateFormWithZod()` BEFORE calling save handler
- [ ] When `zodSchema` provided: submit with validation errors does NOT call API (early return with errors displayed)
- [ ] When `zodSchema` provided: validates on blur via `validateFieldWithZod()`
- [ ] When `zodSchema` NOT provided: falls back to manual required-field validation (backward compatible)
- [ ] Form data is unflattened before Zod validation (dot-notation -> nested objects)
- [ ] Zod error paths are converted to field IDs (path.join('.'))
- [ ] `extractZodIssueParams()` correctly extracts `min`, `max`, `expected`, `received` from Zod issues
- [ ] Error messages are translated via `resolveValidationMessage()` with interpolated params
- [ ] `t` from `useTranslations()` is cast to `(key: string, ...) => string` for validation helpers
- [ ] All 12 create pages pass their Create schema
- [ ] All 12 edit pages pass their Update schema
- [ ] `formatZodErrorMessage()` removed from EntityCreateContent
- [ ] Server errors in EntityCreateContent resolved through `resolveValidationMessage()`
- [ ] Server errors in EntityEditContent resolved through `resolveValidationMessage()`
- [ ] All 4 TODOs removed from EntityFormProvider (lines 60, 151, 199, 221)

### Phase 4

- [ ] All new unit tests pass (validate-form, schema-registry, resolve-validation-message)
- [ ] Integration tests pass (zod-validation)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] Manual verification checklist completed (section 6, Task 4.5)

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing keys in validation.json | Medium | Extraction script ensures completeness. `resolveValidationMessage()` returns original key as fallback. Re-run extraction if schemas change. |
| Large JSON file (~2,000 lines) | Low | Single file is still fast. Existing system handles 4,120+ keys. Static import = no runtime cost. |
| Schema field paths don't match form field IDs | High | Verified: forms use dot-notation that maps directly to Zod paths. Pre-requisite check in Phase 3 intro. Test with each entity. |
| Breaking existing manual validation | Medium | Backward compatible: `zodSchema` prop is optional. Without it, existing behavior unchanged. |
| Cross-field validation (refine) | Low | `validateFieldWithZod` validates full object context. `.refine()` results will be included. |
| Dynamic keys from factory | Medium | Extraction script resolves known fields. Document unresolvable keys with warnings. |
| defaultHook breaks per-route hooks | Low | Verified in @hono/zod-openapi source: per-route hook completely replaces defaultHook. They don't stack. |
| Accented characters encoding | Low | UTF-8 throughout codebase. JSON files, TypeScript, and React all support Unicode. Matches 808+ existing accented translations. |
| Form data shape mismatch with schema | High | `unflattenValues()` converts flat form data to nested objects before Zod validation. Documented in Task 3.2. |
| Update schema validates all fields as optional | Low | Expected behavior: `.partial()` makes everything optional. Only provided values are validated. Empty fields pass. |
| Naming inconsistency (underscore vs camelCase) | Medium | Both variants included in translation JSON. `resolveValidationMessage()` maps as-is without normalization. |
| i18n type generation with ~1,037 new keys | Low | Types file grows but `generate-types.ts` handles it. Build time increase negligible. |
| `t` function type mismatch (`TranslationKey` vs `string`) | Medium | `useTranslations()` returns `t: (key: TranslationKey) => string` but validation helpers need `(key: string) => string`. Use explicit cast: `t as (key: string, params?: Record<string, unknown>) => string`. This is safe because `resolveValidationMessage` constructs keys dynamically that are valid after type regeneration. |
| Missing params in translated messages | Medium | `extractZodIssueParams()` extracts `min`, `max`, `expected`, `received` from Zod issues. Without it, `{{min}}` placeholders would render literally. Function must handle all Zod issue subtypes. |

## 10. Out of Scope

| Item | Rationale |
|------|-----------|
| EN/PT translations | Separate spec. Placeholder files created to prevent `[MISSING:]` errors. |
| Web app form validation | Admin-only scope. Web uses different form patterns (native HTML, Astro components). |
| New validation rules | This spec only translates existing rules, does not add new ones. |
| Real-time keystroke validation | Only blur and submit. Real-time would be noisy and costly. |
| Custom error formatting/styling | Error display styling is handled by existing form components. |
| Zod schema refactoring | Schemas are not modified, only their messages are translated. |
| ValidatedForm.tsx changes | Separate component hierarchy, not used by entity CRUD pages (see 3.7). |
| Consolidating existing scattered validation keys | `error.field.*` and `admin-common.validatedForm.*` serve different purposes (UI messages vs schema validation). No migration needed. |
| Fixing 5 `.refine()` plain English messages | Server-side only, don't surface to admin forms. Documented in 3.8 for future fix. |

---

**Spec Version**: 3.0 (deep audit with code verification 2026-03-10)

**Changes from v2.0**:

- **[C1] Fixed**: Added validation-before-submit wiring in Task 3.3 (`handleSave` calls `validateForm` before API call)
- **[C2] Fixed**: Documented `t` function type mismatch and added explicit cast pattern throughout
- **[C3] Fixed**: Added `extractZodIssueParams()` helper (section 4.6) and implementation in Task 3.2
- **[C4] Fixed**: Corrected `EventCreateInputSchema` typo to `EventUpdateInputSchema` in schema registry table
- **[C5] Fixed**: Added `apps/api/src/routes/exchange-rates/admin/index.ts` to extraction scope
- **[M1] Fixed**: Removed `service-core/src/base/base.service.ts` from secondary locations (uses `zodError` as variable name, not i18n key)
- **[M2] Fixed**: Corrected TODO count to 4 (lines 60, 151, 199, 221) with accurate descriptions
- **[M3] Added**: Section 4.9 documenting double `validation.validation.*` key structure
- **[M4] Fixed**: Corrected identical strings in manual verification checklist
- **[M5] Added**: Section 4.7 explaining why Zod v4 native locales were rejected
- **[M6] Fixed**: Added underscore naming from `validation-messages.ts` to section 3.1.1
- **[R3] Added**: Section 4.8 documenting `ZodSchema` type compatibility in Zod v4
