/**
 * @file EditableContentCard.test.ts
 * @description Source-level regression tests for `EditableContentCard.astro`
 * (HOS-374 Phase 2 2C-1). Asserts the card renders THREE independent state
 * badges (moderation, visibility, lifecycle) — never collapsed into one
 * "draft/published" boolean — and links to the (not yet built) edit route
 * without inline SVGs, hardcoded colors, or Tailwind classes.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(
    resolve(__dirname, '../../../src/components/account/EditableContentCard.astro'),
    'utf8'
);

/**
 * The markup half of the file — everything after the frontmatter fence.
 *
 * Asserting on the whole source cannot tell a badge that is RENDERED from one
 * whose label map merely still exists in the frontmatter: deleting a badge from
 * the template leaves every `*_LABELS` constant and `*LabelPrefix` binding
 * untouched, so a whole-file `toContain` stays green over a card that no longer
 * shows the state. Scope the render assertions to the template.
 */
const componentMarkup = componentSource.slice(componentSource.lastIndexOf('---') + 3);

describe('EditableContentCard.astro', () => {
    it('accepts moderationState, visibility, and lifecycleState as three separate props', () => {
        expect(componentSource).toContain('readonly moderationState: string');
        expect(componentSource).toContain('readonly visibility: string');
        expect(componentSource).toContain('readonly lifecycleState: string');
    });

    it('declares three distinct badge label maps, not one shared status map', () => {
        expect(componentSource).toContain('MODERATION_LABELS');
        expect(componentSource).toContain('VISIBILITY_LABELS');
        expect(componentSource).toContain('LIFECYCLE_LABELS');
    });

    it('actually renders all three badges in the template', () => {
        // The load-bearing assertion of this component. HOS-374 §7.6.1 keeps
        // the three columns orthogonal precisely so an author can tell "the
        // platform has not approved this yet" from "I have not published it
        // myself" — dropping one badge silently reintroduces the conflation
        // the model exists to prevent.
        expect(componentMarkup).toContain('{moderationInfo.label}');
        expect(componentMarkup).toContain('{visibilityInfo.label}');
        expect(componentMarkup).toContain('{lifecycleInfo.label}');
    });

    it('renders exactly three badge rows — no more, no fewer', () => {
        const badgeRows = componentMarkup.match(/class="editable-content-card__badge-row"/g) ?? [];
        expect(badgeRows).toHaveLength(3);
    });

    it('renders each badge prefix in the template, not only in the frontmatter', () => {
        expect(componentMarkup).toContain('{moderationLabelPrefix}');
        expect(componentMarkup).toContain('{visibilityLabelPrefix}');
        expect(componentMarkup).toContain('{lifecycleLabelPrefix}');
    });

    it('labels each badge with a distinguishing text prefix (never color alone)', () => {
        expect(componentSource).toContain('moderationLabelPrefix');
        expect(componentSource).toContain('visibilityLabelPrefix');
        expect(componentSource).toContain('lifecycleLabelPrefix');
        expect(componentSource).toContain('account.myContent.status.moderation.label');
        expect(componentSource).toContain('account.myContent.status.visibility.label');
        expect(componentSource).toContain('account.myContent.status.lifecycle.label');
    });

    it('covers every enum value for each of the three states', () => {
        for (const key of ['PENDING', 'APPROVED', 'REJECTED']) {
            expect(componentSource).toContain(`account.myContent.status.moderation.${key}`);
        }
        for (const key of ['PUBLIC', 'PRIVATE', 'RESTRICTED']) {
            expect(componentSource).toContain(`account.myContent.status.visibility.${key}`);
        }
        for (const key of ['DRAFT', 'ACTIVE', 'ARCHIVED']) {
            expect(componentSource).toContain(`account.myContent.status.lifecycle.${key}`);
        }
    });

    it('links to the not-yet-built edit route via buildUrl (no admin fallback)', () => {
        expect(componentSource).toContain('const editUrl = buildUrl({ locale, path:');
        expect(componentSource).toContain('editBasePath');
        expect(componentSource).not.toContain('/admin/');
    });

    it('uses only @repo/icons or no icons — never an inline <svg>', () => {
        expect(componentSource).not.toContain('<svg');
    });

    it('uses var(--radius-card) for the card, never the deprecated organic radius', () => {
        expect(componentSource).toContain('var(--radius-card');
        expect(componentSource).not.toContain('--radius-organic');
    });

    it('does not use Tailwind utility classes', () => {
        expect(componentSource).not.toMatch(/class="[^"]*\b(flex|grid|p-\d|m-\d)\b/);
    });
});
