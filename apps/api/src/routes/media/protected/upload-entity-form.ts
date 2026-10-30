/**
 * Multipart form parsing for `POST /api/v1/protected/media/upload-entity`.
 *
 * Reads the multipart body and validates its fields against
 * `ProtectedUploadEntityRequestSchema` (steps 2 and 3 of the route). Split out
 * of the route to keep it under the file size cap (HOS-1682); the refusals and
 * their order are the route's, unchanged.
 */
import { ProtectedUploadEntityRequestSchema } from '@repo/schemas';
import type { Context } from 'hono';
import type { z } from 'zod';
import { createErrorResponse } from '../../../utils/response-helpers';

/** The validated form fields of an entity upload. */
export type UploadEntityFormFields = z.infer<typeof ProtectedUploadEntityRequestSchema>;

/** Outcome of {@link parseUploadEntityForm}. */
export type UploadEntityFormResult =
    | { readonly ok: true; readonly formData: FormData; readonly fields: UploadEntityFormFields }
    | { readonly ok: false; readonly response: Response };

/**
 * Parse the multipart body and validate its form fields.
 *
 * @param input.ctx - The request context.
 * @returns The form data and the validated fields, or the 400 response to answer.
 */
export const parseUploadEntityForm = async ({
    ctx
}: {
    readonly ctx: Context;
}): Promise<UploadEntityFormResult> => {
    // ── 2. Parse multipart form data ──────────────────────────────────────
    let formData: FormData;
    try {
        formData = await ctx.req.formData();
    } catch {
        return {
            ok: false,
            response: createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    reason: 'INVALID_MULTIPART_DATA',
                    message: 'Invalid multipart form data'
                },
                ctx,
                400
            )
        };
    }

    // ── 3. Validate form fields with Zod ──────────────────────────────────
    const rawTags = formData.get('tags');
    const tagsArray =
        typeof rawTags === 'string' && rawTags.length > 0
            ? rawTags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0)
            : undefined;

    const rawOverwrite = formData.get('overwrite');
    const overwriteBool =
        typeof rawOverwrite === 'string'
            ? rawOverwrite === 'true'
                ? true
                : rawOverwrite === 'false'
                  ? false
                  : undefined
            : undefined;

    const rawFields = {
        entityType: formData.get('entityType'),
        entityId: formData.get('entityId'),
        role: formData.get('role'),
        ...(tagsArray === undefined ? {} : { tags: tagsArray }),
        ...(overwriteBool === undefined ? {} : { overwrite: overwriteBool })
    };

    const parseResult = ProtectedUploadEntityRequestSchema.safeParse(rawFields);
    if (!parseResult.success) {
        return {
            ok: false,
            response: createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    reason: 'INVALID_FORM_FIELDS',
                    message: 'Invalid form fields',
                    details: parseResult.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message
                    }))
                },
                ctx,
                400
            )
        };
    }

    return { ok: true, formData, fields: parseResult.data };
};
