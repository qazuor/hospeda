import { z } from 'zod';

/**
 * SEO Schema - Search Engine Optimization information
 *
 * `.strip()` ensures legacy payloads that still carry `keywords` (removed)
 * parse without error — the extra key is silently dropped.
 *
 * ## Why the empty string is accepted (HOS-792)
 *
 * Both fields are OPTIONAL overrides: when they are absent, each consumer
 * falls back to a value it computes itself (an accommodation's `name` for the
 * title, its `summary` for the description — see `pickLocalizedSeo` in
 * `apps/web/src/lib/seo.ts`, which treats any falsy stored value as "no
 * override"). The length bounds exist to keep an override that IS authored
 * inside what a search engine will actually render.
 *
 * Before this, `''` failed `.min()` like any other short string. That made a
 * stored override impossible to REMOVE: the host editor sends a diff, so
 * clearing the field put `''` on the wire and the request was rejected by
 * both the client-side slice and the server. Nothing anywhere could return
 * the field to its default once a value had been saved.
 *
 * So `''` is admitted explicitly and means exactly "no override" — the same
 * thing an absent key means. The bounds still apply to every non-empty value,
 * which is the case they were written for.
 */
export const SeoSchema = z
    .object({
        title: z
            .union(
                [
                    z.literal(''),
                    z
                        .string({
                            message: 'zodError.common.seo.title.required'
                        })
                        .min(30, { message: 'zodError.common.seo.title.min' })
                        .max(60, { message: 'zodError.common.seo.title.max' })
                ],
                // Zod reports `invalid_union` for a non-string input, which swallows
                // the branch's own `invalid_type` message and emits the literal
                // "Invalid input" — untranslatable, since it carries no `zodError.`
                // prefix for the message resolver to look up. Naming the union keeps
                // the key reachable. Length errors are unaffected: Zod unwraps
                // `too_small`/`too_big` with their message and bounds intact.
                { message: 'zodError.common.seo.title.required' }
            )
            .optional(),
        description: z
            .union(
                [
                    z.literal(''),
                    z
                        .string({
                            message: 'zodError.common.seo.description.required'
                        })
                        .min(70, { message: 'zodError.common.seo.description.min' })
                        .max(160, { message: 'zodError.common.seo.description.max' })
                ],
                { message: 'zodError.common.seo.description.required' }
            )
            .optional()
    })
    .strip();
export type Seo = z.infer<typeof SeoSchema>;

/**
 * Base SEO fields
 */
export const BaseSeoFields = {
    seo: SeoSchema.nullish()
} as const;
