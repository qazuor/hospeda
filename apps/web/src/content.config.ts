/**
 * @file content.config.ts
 * @description Astro Content Collections for the web app.
 *
 * The `beta` collection backs the private beta tester documentation site
 * served under `/beta/*`. Spanish-only, no `/{lang}/` namespace, removed when
 * the beta period ends.
 */

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Top-level role groupings for the beta docs sidebar.
 * Drives ordering and badge styling in the navigation.
 */
const betaRoleEnum = z.enum([
    'common',
    'empezar',
    'turista',
    'host',
    'admin-editor',
    'pagos',
    'reportar-bugs',
    'faq'
]);

/**
 * Frontmatter schema for files under `src/content/beta/**`.
 *
 * - `title` and `description` feed the page head and sidebar.
 * - `order` controls intra-section sorting (lowest first).
 * - `role` groups the page in the sidebar and determines the badge.
 * - `section` is a free-form label for sub-groupings inside a role (e.g.
 *   "Reservar", "Mi cuenta") — purely cosmetic.
 * - `draft` hides the page from the sidebar and the search index.
 * - `audience` narrows which testers see the entry inside its role group.
 *   Optional. Currently used to split `admin-editor` pages between admin-only
 *   and editor-eligible. If absent, the entry is shown to anyone who already
 *   sees the parent role.
 */
const beta = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/beta' }),
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        order: z.number().default(999),
        role: betaRoleEnum.default('common'),
        section: z.string().optional(),
        draft: z.boolean().default(false),
        audience: z.array(z.enum(['admin', 'editor', 'host', 'turista'])).optional()
    })
});

export const collections = { beta };
