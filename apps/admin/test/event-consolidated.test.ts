/**
 * @file event-consolidated.test.ts
 * @description Tests for the Event consolidated config, specifically asserting
 * the FR-1 / FR-5 contract:
 *   - `event.description` is `FieldTypeEnum.RICH_TEXT` (not TEXTAREA).
 *   - `typeConfig.allowedFeatures` includes the full toolbar set INCLUDING `LINK`.
 *   - `required === true` and `maxLength === 5000` are preserved.
 *   - The textarea-only `minRows` key is dropped.
 *
 * Mirrors the structure of `apps/admin/test/accommodation-consolidated.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    FieldTypeEnum,
    RichTextFeatureEnum
} from '../src/components/entity-form/enums/form-config.enums';
import { createEventConsolidatedConfig } from '../src/features/events/config/event-consolidated.config';

// Mock translation function — returns the i18n key verbatim
const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

describe('EventConsolidatedConfig', () => {
    describe('createEventConsolidatedConfig — FR-1 / FR-5', () => {
        it('exposes the basic-info section', () => {
            const config = createEventConsolidatedConfig(mockT);
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            expect(basicInfo).toBeDefined();
        });

        it('declares event.description as RICH_TEXT (FR-1)', () => {
            const config = createEventConsolidatedConfig(mockT);
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            expect(description).toBeDefined();
            expect(description?.type).toBe(FieldTypeEnum.RICH_TEXT);
        });

        it('preserves description maxLength=5000 and required=true (FR-1)', () => {
            const config = createEventConsolidatedConfig(mockT);
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            // The RichTextFieldConfig carries maxLength under typeConfig
            const typeConfig = description?.typeConfig as
                | { maxLength?: number; minRows?: number; minLength?: number }
                | undefined;
            expect(typeConfig?.maxLength).toBe(5000);
            expect(description?.required).toBe(true);
        });

        it('drops the textarea-only minRows key on the RICH_TEXT description (FR-1)', () => {
            const config = createEventConsolidatedConfig(mockT);
            const basicInfo = config.sections.find((s) => s.id === 'basic-info');
            const description = basicInfo?.fields.find((f) => f.id === 'description');

            const typeConfig = description?.typeConfig as { minRows?: number } | undefined;
            expect(typeConfig?.minRows).toBeUndefined();
        });

        it('declares allowedFeatures with the full toolbar set INCLUDING LINK (FR-1 / FR-5)', () => {
            const config = createEventConsolidatedConfig(mockT);
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
