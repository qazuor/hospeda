/**
 * @file post-consolidated.test.ts
 * @description Tests for the Post consolidated config, asserting the SPEC-187
 * FR-5 contract for `post.content`:
 *   - `allowedFeatures` declares the full toolbar set INCLUDING `LINK`.
 *   - Field remains RICH_TEXT (no type flip in Phase 1 for posts).
 *
 * Mirrors the structure of `apps/admin/test/event-consolidated.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    FieldTypeEnum,
    RichTextFeatureEnum
} from '../src/components/entity-form/enums/form-config.enums';
import { createPostConsolidatedConfig } from '../src/features/posts/config/post-consolidated.config';

const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

describe('PostConsolidatedConfig', () => {
    describe('SPEC-187 FR-5 — post.content allowedFeatures includes LINK', () => {
        it('exposes the content section with a content field', () => {
            const config = createPostConsolidatedConfig(mockT);
            const contentSection = config.sections.find((s) => s.id === 'content');
            const content = contentSection?.fields.find((f) => f.id === 'content');

            expect(content).toBeDefined();
            // Post.content stays RICH_TEXT in Phase 1
            expect(content?.type).toBe(FieldTypeEnum.RICH_TEXT);
        });

        it('declares allowedFeatures with the full toolbar set INCLUDING LINK', () => {
            const config = createPostConsolidatedConfig(mockT);
            const contentSection = config.sections.find((s) => s.id === 'content');
            const content = contentSection?.fields.find((f) => f.id === 'content');

            const typeConfig = content?.typeConfig as
                | { allowedFeatures?: RichTextFeatureEnum[] }
                | undefined;
            const features = typeConfig?.allowedFeatures;

            expect(features).toBeDefined();
            expect(features).toContain(RichTextFeatureEnum.BOLD);
            expect(features).toContain(RichTextFeatureEnum.ITALIC);
            expect(features).toContain(RichTextFeatureEnum.UNDERLINE);
            expect(features).toContain(RichTextFeatureEnum.LIST);
            expect(features).toContain(RichTextFeatureEnum.ORDERED_LIST);
            expect(features).toContain(RichTextFeatureEnum.HEADING);
            expect(features).toContain(RichTextFeatureEnum.QUOTE);
            expect(features).toContain(RichTextFeatureEnum.LINK);
        });
    });
});
