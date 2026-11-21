/**
 * @file article.schema.ts
 * @description Zod schemas of the help catalog (HOS-2410 `docs/data-model.md`
 * §2 and §4): the YAML frontmatter of one article, one article as the index
 * stores it, and the whole index. Types are inferred from them.
 */

import { z } from 'zod';
import { HELP_ANCHOR_KINDS, parseHelpAnchor } from './anchors';
import {
    HELP_AUDIENCES,
    HELP_FOLDERS,
    HELP_INDEX_VERSION,
    HELP_LOCALES,
    HELP_MAX_STEPS,
    HELP_RELATED_MAX,
    HELP_RELATED_MIN,
    HELP_VERTICALS
} from './constants';
import { HelpDestinationSchema } from './destination.schema';

/** Article id: kebab-case, at most 64 characters (same rule as the TS catalog had). */
export const HelpArticleIdSchema = z
    .string()
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** A string that carries no `{{` token (title, summary, keywords). */
const tokenFree = (schema: z.ZodString) =>
    schema.refine((value) => !value.includes('{{') && !value.includes('}}'), {
        message: 'tokens are not allowed here'
    });

/** An array whose items are all different. */
const uniqueArray = <T extends z.ZodType<string>>(item: T) =>
    z.array(item).refine((values) => new Set(values).size === values.length, {
        message: 'items must be unique'
    });

/** A `kind:target` anchor of `covers` (`docs/data-model.md` §2.2). */
export const HelpAnchorSchema = z
    .string()
    .refine((value) => parseHelpAnchor({ anchor: value }) !== undefined, {
        message: `not an anchor: kind must be one of ${HELP_ANCHOR_KINDS.join(', ')} and the target must have its shape`
    });

/** A `page:` or `section:` anchor, the only kinds an `entryFor` may hold. */
export const HelpEntryAnchorSchema = HelpAnchorSchema.refine(
    (value) => {
        const kind = parseHelpAnchor({ anchor: value })?.kind;
        return kind === 'page' || kind === 'section';
    },
    { message: 'entryFor holds only page: and section: anchors' }
);

/** The verticals an article may name: every vertical but `tourist`. */
export const HelpVerticalSchema = z.enum(HELP_VERTICALS);

/** A machine-translation mark, required on non-es files and forbidden on es (§2). */
export const HelpTranslationSchema = z
    .object({
        status: z.enum(['machine', 'reviewed', 'declared']),
        sourceReviewedAt: z.iso.date()
    })
    .strict();

/** The frontmatter of one article. Strict: an unknown key fails. */
export const HelpArticleFrontmatterSchema = z
    .object({
        id: HelpArticleIdSchema,
        title: tokenFree(z.string().min(1).max(120)),
        summary: tokenFree(z.string().min(1).max(240)),
        audiences: uniqueArray(z.enum(HELP_AUDIENCES)).min(1),
        verticals: uniqueArray(HelpVerticalSchema),
        keywords: uniqueArray(tokenFree(z.string().min(1).max(60))).min(1),
        destinations: z.array(HelpDestinationSchema),
        faqKey: z
            .string()
            .regex(/^[a-z]+\.[A-Za-z0-9]+$/)
            .optional(),
        public: z.boolean(),
        related: uniqueArray(HelpArticleIdSchema).min(HELP_RELATED_MIN).max(HELP_RELATED_MAX),
        covers: uniqueArray(HelpAnchorSchema).min(1),
        entryFor: uniqueArray(HelpEntryAnchorSchema),
        reviewedAt: z.iso.date(),
        translation: HelpTranslationSchema.optional()
    })
    .strict()
    .refine((article) => !article.related.includes(article.id), {
        message: 'an article cannot be related to itself',
        path: ['related']
    });

/** The frontmatter of one article. */
export type HelpArticleFrontmatter = z.infer<typeof HelpArticleFrontmatterSchema>;

/** The body of one article, split into its five authored sections (§3). */
export const HelpArticleSectionsSchema = z
    .object({
        canDo: z.string().min(1),
        howTo: z
            .object({
                steps: z.array(z.string().min(1)).min(1).max(HELP_MAX_STEPS),
                after: z.string()
            })
            .strict(),
        expect: z.string().min(1),
        notExpect: z.string().min(1),
        troubleshooting: z.string().min(1)
    })
    .strict();

/** The body of one article. */
export type HelpArticleSections = z.infer<typeof HelpArticleSectionsSchema>;

/** One article as the index stores it: the frontmatter plus where it lives and its body. */
export const HelpArticleSchema = z
    .object({
        id: HelpArticleIdSchema,
        locale: z.enum(HELP_LOCALES),
        folder: z.enum(HELP_FOLDERS),
        title: z.string().min(1).max(120),
        summary: z.string().min(1).max(240),
        audiences: z.array(z.enum(HELP_AUDIENCES)).min(1),
        verticals: z.array(HelpVerticalSchema),
        keywords: z.array(z.string().min(1)).min(1),
        destinations: z.array(HelpDestinationSchema),
        faqKey: z
            .string()
            .regex(/^[a-z]+\.[A-Za-z0-9]+$/)
            .optional(),
        public: z.boolean(),
        related: z.array(HelpArticleIdSchema),
        covers: z.array(HelpAnchorSchema).min(1),
        entryFor: z.array(HelpEntryAnchorSchema),
        reviewedAt: z.iso.date(),
        translation: HelpTranslationSchema.nullable(),
        sections: HelpArticleSectionsSchema
    })
    .strict();

/** One article of the index. */
export type HelpArticle = z.infer<typeof HelpArticleSchema>;

/** The articles of one locale: ids are unique. */
const LocaleArticlesSchema = z.array(HelpArticleSchema).superRefine((articles, ctx) => {
    const seen = new Set<string>();
    for (const [index, article] of articles.entries()) {
        if (seen.has(article.id)) {
            ctx.addIssue({
                code: 'custom',
                path: [index, 'id'],
                message: `duplicate help article id: ${article.id}`
            });
        }
        seen.add(article.id);
    }
});

/** The whole `help-index.json` (§4). */
export const HelpIndexSchema = z
    .object({
        version: z.literal(HELP_INDEX_VERSION),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        locales: z
            .object({
                es: LocaleArticlesSchema,
                en: LocaleArticlesSchema.optional(),
                pt: LocaleArticlesSchema.optional()
            })
            .strict()
    })
    .strict();

/** The whole help index. */
export type HelpIndex = z.infer<typeof HelpIndexSchema>;

/**
 * Validates a help index. Throws on a malformed one: the API must not start
 * with a help index it cannot trust (spec §5.2, AC-14).
 *
 * @param args.raw - The parsed JSON
 * @returns The typed index
 * @throws {z.ZodError} When the index does not match {@link HelpIndexSchema}
 */
export function parseHelpIndex({ raw }: { readonly raw: unknown }): HelpIndex {
    return HelpIndexSchema.parse(raw);
}
