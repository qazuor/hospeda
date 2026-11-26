import { StrongPasswordSchema } from '@repo/schemas';
import { z } from 'zod';
import { EmailFormatSchema } from './email-format';

/** Email field shared by the credential and password recovery forms. */
export function authEmailSchema({
    required,
    invalid
}: {
    readonly required: string;
    readonly invalid: string;
}) {
    return z
        .string()
        .trim()
        .superRefine((value, ctx) => {
            if (!value || !EmailFormatSchema.safeParse(value).success) {
                ctx.addIssue({ code: 'custom', message: value ? invalid : required });
            }
        });
}

/** Validate against the canonical password policy without exposing schema copy. */
export function signupPasswordSchema({
    weak,
    tooLong
}: {
    readonly weak: string;
    readonly tooLong: string;
}) {
    return z.string().superRefine((password, ctx) => {
        const result = StrongPasswordSchema.safeParse(password);
        if (!result.success) {
            ctx.addIssue({
                code: 'custom',
                message: result.error.issues.some((issue) => issue.code === 'too_big')
                    ? tooLong
                    : weak
            });
        }
    });
}
