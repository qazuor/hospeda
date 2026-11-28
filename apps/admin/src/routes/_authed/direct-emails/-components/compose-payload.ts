/**
 * @file compose-payload.ts
 * @description Builds and validates the send payload of the compose screen
 * (HOS-2685) with the same Zod schema the API uses, and maps the issues to the
 * form field they belong to.
 */

import {
    type SendDirectEmailRequest,
    SendDirectEmailRequestSchema,
    type TestSendDirectEmailRequest,
    TestSendDirectEmailRequestSchema
} from '@repo/schemas';
import type { TiptapDocument } from '@repo/utils';

/** Form fields that can carry a validation error. */
export type ComposeField = 'subject' | 'bodyJson' | 'recipients' | 'form';

/** Raw compose form values. */
export interface ComposeValues {
    readonly subject: string;
    readonly bodyJson: TiptapDocument | null;
    readonly recipients: ReadonlyArray<string>;
    readonly templateId: string | null;
}

/** Validation errors: the first message (an i18n key) per field. */
export type ComposeErrors = Readonly<Partial<Record<ComposeField, string>>>;

/** Outcome of {@link buildSendPayload}. */
export type BuildSendPayloadResult =
    | { readonly success: true; readonly payload: SendDirectEmailRequest }
    | { readonly success: false; readonly errors: ComposeErrors };

/** Outcome of {@link buildTestSendPayload}. */
export type BuildTestSendPayloadResult =
    | { readonly success: true; readonly payload: TestSendDirectEmailRequest }
    | { readonly success: false; readonly errors: ComposeErrors };

const EMPTY_DOC = { type: 'doc', content: [] } as const;

function mapIssues({
    issues
}: {
    readonly issues: ReadonlyArray<{
        readonly path: ReadonlyArray<PropertyKey>;
        readonly message: string;
    }>;
}): ComposeErrors {
    const errors: Partial<Record<ComposeField, string>> = {};
    for (const issue of issues) {
        const head = issue.path[0];
        const field: ComposeField =
            head === 'subject' || head === 'bodyJson' || head === 'recipients' ? head : 'form';
        if (!errors[field]) errors[field] = issue.message;
    }
    return errors;
}

/**
 * Validates the compose values against `SendDirectEmailRequestSchema`.
 *
 * @param input.values - Current form values.
 * @returns The typed payload, or the first error message per field.
 */
export function buildSendPayload({
    values
}: {
    readonly values: ComposeValues;
}): BuildSendPayloadResult {
    const parsed = SendDirectEmailRequestSchema.safeParse({
        subject: values.subject,
        bodyJson: values.bodyJson ?? EMPTY_DOC,
        recipients: [...values.recipients],
        ...(values.templateId ? { templateId: values.templateId } : {})
    });
    if (parsed.success) return { success: true, payload: parsed.data };

    return { success: false, errors: mapIssues({ issues: parsed.error.issues }) };
}

/**
 * Validates a test send (subject and body only) with the API schema.
 *
 * @param input.subject - Subject as typed.
 * @param input.bodyJson - Editor document.
 * @param input.toEmail - Override address; omit to use the admin's own.
 * @returns The typed payload, or the first error per field.
 */
export function buildTestSendPayload({
    subject,
    bodyJson,
    toEmail
}: {
    readonly subject: string;
    readonly bodyJson: TiptapDocument | null;
    readonly toEmail?: string;
}): BuildTestSendPayloadResult {
    const parsed = TestSendDirectEmailRequestSchema.safeParse({
        subject,
        bodyJson: bodyJson ?? EMPTY_DOC,
        ...(toEmail ? { toEmail } : {})
    });
    if (parsed.success) return { success: true, payload: parsed.data };
    return { success: false, errors: mapIssues({ issues: parsed.error.issues }) };
}
