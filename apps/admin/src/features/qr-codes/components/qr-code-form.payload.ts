import type { QrCode, QrCodeCreateHttp, QrCodeUpdateHttp } from '@repo/schemas';
import {
    QrCodeCreateHttpSchema,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    QrCodeSourceEnum,
    QrCodeUpdateHttpSchema
} from '@repo/schemas';

/**
 * Turning the QR form's state into a request body — the whole of it (HOS-981 PR 3).
 *
 * Pure functions, no React. Split out of `QrCodeForm.tsx` for two reasons: the
 * component was over the repo's 500-line ceiling, and this is the half worth
 * testing directly. Every decision that can silently lose an operator's work
 * lives here.
 *
 * The failure shape it returns follows the repo's existing pattern
 * (`features/announcements/AnnouncementForm.tsx`): a discriminated
 * `{ payload } | { error }`, never a throw. A builder that threw into a
 * `form.handleSubmit()` nobody caught produced the worst possible outcome — a
 * click that neither saves nor complains.
 *
 * @module features/qr-codes/components/qr-code-form.payload
 */

/** The drawing options the form edits. Mirrors `QrCodeRenderOptions`. */
export type RenderOptionsValues = {
    format: QrCodeFormatEnum;
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum;
    margin: number;
    /** Empty string means "unconstrained" — the schema's `null`. */
    size: string;
    foregroundColor: string;
    backgroundColor: string;
};

/** Everything the form holds. `slug` is only ever populated in create mode. */
export type QrCodeFormValues = {
    label: string;
    targetUrl: string;
    description: string;
    slug: string;
    isActive: boolean;
    renderOptions: RenderOptionsValues;
};

/**
 * Why a build failed, in a shape the form can render.
 *
 * `messageKey` is a leaf under `admin-qr-codes.messages`, deliberately OUR copy
 * rather than the raw Zod message: the HTTP schemas mix i18n-keyed messages with
 * Zod's own English defaults (`z.string().url()` carries no custom message), so
 * showing the raw issue text would put "Invalid url" in a Spanish panel.
 *
 * `fields` names the form fields to mark, so the operator is not left comparing
 * a banner against ten inputs.
 */
export type QrCodeFormError = {
    readonly messageKey: 'requiredLabel' | 'requiredTargetUrl' | 'invalid';
    readonly fields: readonly string[];
};

export type QrCodeFormBuildResult =
    | { readonly payload: QrCodeCreateHttp | QrCodeUpdateHttp }
    | { readonly error: QrCodeFormError };

export const DEFAULT_RENDER_OPTIONS: RenderOptionsValues = {
    format: QrCodeFormatEnum.SVG,
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M,
    margin: 4,
    size: '',
    foregroundColor: '#000000',
    backgroundColor: '#ffffff'
};

/** Turns a stored render document into the form's string-friendly shape. */
export function toFormRenderOptions(qrCode?: QrCode): RenderOptionsValues {
    if (!qrCode) return { ...DEFAULT_RENDER_OPTIONS };
    const stored = qrCode.renderOptions;
    return {
        format: stored.format,
        errorCorrectionLevel: stored.errorCorrectionLevel,
        margin: stored.margin,
        size: stored.size === null ? '' : String(stored.size),
        foregroundColor: stored.foregroundColor,
        backgroundColor: stored.backgroundColor
    };
}

/** `''` is the UI's spelling of "do not constrain the size". */
export function parseSize(size: string): number | null {
    const trimmed = size.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The drawing fields whose value actually changed.
 *
 * Returns `undefined` when nothing did, so an edit that only renamed the code
 * sends no `renderOptions` key at all. Comparing against the LOADED row rather
 * than against the schema defaults is the point: a code stored red must not be
 * reported as "changed to black" merely because black is the default.
 */
export function diffRenderOptions(
    current: RenderOptionsValues,
    original: RenderOptionsValues
): Record<string, unknown> | undefined {
    const patch: Record<string, unknown> = {};

    if (current.format !== original.format) patch.format = current.format;
    if (current.errorCorrectionLevel !== original.errorCorrectionLevel) {
        patch.errorCorrectionLevel = current.errorCorrectionLevel;
    }
    if (Number(current.margin) !== Number(original.margin)) patch.margin = Number(current.margin);
    if (current.size.trim() !== original.size.trim()) patch.size = parseSize(current.size);
    if (current.foregroundColor !== original.foregroundColor) {
        patch.foregroundColor = current.foregroundColor;
    }
    if (current.backgroundColor !== original.backgroundColor) {
        patch.backgroundColor = current.backgroundColor;
    }

    return Object.keys(patch).length > 0 ? patch : undefined;
}

/**
 * The two emptiness checks Zod cannot phrase usefully.
 *
 * Run BEFORE `safeParse` so an operator who left the destination blank is told
 * which field is blank, rather than being handed a generic "invalid" for a form
 * with ten inputs.
 */
function checkRequired(values: QrCodeFormValues): QrCodeFormError | undefined {
    if (values.label.trim() === '') {
        return { messageKey: 'requiredLabel', fields: ['label'] };
    }
    if (values.targetUrl.trim() === '') {
        return { messageKey: 'requiredTargetUrl', fields: ['targetUrl'] };
    }
    return undefined;
}

/**
 * Maps Zod issues onto form field names.
 *
 * `renderOptions.margin` becomes `renderOptions.margin`, which is exactly the
 * `form.Field` name the drawing fieldset uses, so the marking lands on the input
 * the operator has to fix.
 */
function fieldsFromIssues(issues: readonly { path: readonly PropertyKey[] }[]): readonly string[] {
    const fields = new Set<string>();
    for (const issue of issues) {
        if (issue.path.length > 0) fields.add(issue.path.map(String).join('.'));
    }
    return [...fields];
}

/**
 * Builds the body for `POST /admin/qr-codes`.
 *
 * `source` is always `MANUAL`: a `GENERATED` code is one the platform derives
 * for an entity, and the panel has no entity picker because minting those is
 * the provider generator's job, not an operator's.
 */
export function buildCreatePayload(values: QrCodeFormValues): QrCodeFormBuildResult {
    const required = checkRequired(values);
    if (required) return { error: required };

    const slug = values.slug.trim();
    const candidate = {
        ...(slug === '' ? {} : { slug }),
        targetUrl: values.targetUrl.trim(),
        label: values.label.trim(),
        description: values.description.trim() === '' ? null : values.description.trim(),
        source: QrCodeSourceEnum.MANUAL,
        isActive: values.isActive,
        renderOptions: {
            format: values.renderOptions.format,
            errorCorrectionLevel: values.renderOptions.errorCorrectionLevel,
            margin: Number(values.renderOptions.margin),
            size: parseSize(values.renderOptions.size),
            foregroundColor: values.renderOptions.foregroundColor,
            backgroundColor: values.renderOptions.backgroundColor
        }
    };

    const parsed = QrCodeCreateHttpSchema.safeParse(candidate);
    if (!parsed.success) {
        return { error: { messageKey: 'invalid', fields: fieldsFromIssues(parsed.error.issues) } };
    }
    return { payload: parsed.data };
}

/**
 * Builds the body for `PATCH /admin/qr-codes/{id}`.
 *
 * Carries no `slug` under any circumstance, and carries `renderOptions` only if
 * a drawing field moved.
 */
export function buildUpdatePayload(
    values: QrCodeFormValues,
    original: QrCode
): QrCodeFormBuildResult {
    const required = checkRequired(values);
    if (required) return { error: required };

    const payload: Record<string, unknown> = {};
    const originalDescription = original.description ?? '';
    const description = values.description.trim();

    if (values.label.trim() !== original.label) payload.label = values.label.trim();
    if (values.targetUrl.trim() !== original.targetUrl) payload.targetUrl = values.targetUrl.trim();
    if (description !== originalDescription) {
        payload.description = description === '' ? null : description;
    }
    if (values.isActive !== original.isActive) payload.isActive = values.isActive;

    const renderOptions = diffRenderOptions(values.renderOptions, toFormRenderOptions(original));
    if (renderOptions) payload.renderOptions = renderOptions;

    const parsed = QrCodeUpdateHttpSchema.safeParse(payload);
    if (!parsed.success) {
        return { error: { messageKey: 'invalid', fields: fieldsFromIssues(parsed.error.issues) } };
    }
    return { payload: parsed.data };
}
