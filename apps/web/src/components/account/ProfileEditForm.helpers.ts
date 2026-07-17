/**
 * @file ProfileEditForm.helpers.ts
 * @description Shared type for the profile edit form subcomponents.
 *
 * HOS-190 slice 3: the local `parseZodErrors` mapper (path[0]-only, hand-rolled
 * i18n resolution) was removed — the form now uses the shared `useZodForm` /
 * `zodIssuesToFieldErrors` primitive from `@/lib/forms` instead, which
 * supports nested paths and the same `{{min}}`/`{{max}}` interpolation. See
 * `src/lib/forms/field-errors.ts` for the replacement.
 */

import type { FieldErrors } from '@/lib/forms/field-errors';

/**
 * Field-level error messages keyed by field name. Re-exports the shared
 * `FieldErrors` type (dotted-path string keys) under the name the profile-edit
 * subcomponents already import, so this migration doesn't require touching
 * every subcomponent's type import just to rename it.
 */
export type ProfileEditFieldErrors = FieldErrors;
