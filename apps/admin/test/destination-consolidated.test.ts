/**
 * @file destination-consolidated.test.ts
 * @description Tests for the Destination consolidated config, asserting the
 * SPEC-187 FR-5 contract for `destination.description`:
 *   - `allowedFeatures` declares the full toolbar set INCLUDING `LINK`.
 *   - Field remains RICH_TEXT (no type flip in Phase 1 for destinations).
 *
 * Mirrors the structure of `apps/admin/test/event-consolidated.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    FieldTypeEnum,
    RichTextFeatureEnum
} from '../src/components/entity-form/enums/form-config.enums';
import { createDestinationConsolidatedConfig } from '../src/features/destinations/config/destination-consolidated.config';

const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

describe('DestinationConsolidatedConfig', () => {
    describe('SPEC-187 FR-5 — destination.description allowedFeatures includes LINK', () => {
        it('exposes the basic-info section with a description field', () => {
            const config = createDestinationConsolidatedConfig(mockT);
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            expect(description).toBeDefined();
            // Destination.description stays RICH_TEXT in Phase 1
            expect(description?.type).toBe(FieldTypeEnum.RICH_TEXT);
        });

        it('declares allowedFeatures with the full toolbar set INCLUDING LINK', () => {
            const config = createDestinationConsolidatedConfig(mockT);
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            const typeConfig = description?.typeConfig as
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
