/**
 * @file account-panel-heading-levels.test.ts
 * @description Regression for HOS-2453: the partner and provider account pages
 * mount these islands directly under the page `<h1>` (their wrapping
 * `AccountSectionCard` carries no title), so their section headings must be
 * `<h2>`. The profile-edit sections, preference toggles and restart-tour
 * follow the same rule. An `<h3>` here skips a level in the document outline.
 *
 * @module test/static-guards/account-panel-heading-levels
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src/components');

const FILES = [
    'account/PartnerEditForm.client.tsx',
    'host/host-trades/ProviderUsagesPanel.client.tsx',
    'host/host-trades/ProviderReviewsPanel.client.tsx',
    'host/host-trades/ProviderQrPanel.client.tsx',
    'account/ProfileEditIdentitySection.tsx',
    'account/ProfileEditContactSection.tsx',
    'account/ProfileEditAboutSection.tsx',
    'account/ProfileEditSocialSection.tsx',
    'account/ProfileEditSecuritySection.tsx',
    'account/PreferenceToggles.client.tsx',
    'account/RestartTour.client.tsx'
] as const;

describe('account panels sit directly under the page h1 (HOS-2453)', () => {
    it.each(FILES)('%s uses no h3', (file) => {
        const source = readFileSync(resolve(SRC, file), 'utf8');
        expect(source).not.toMatch(/<h3[\s>]/);
        // A kit `Section` renders its own h2 (headingLevel defaults to 2).
        expect(source).toMatch(/<h2[\s>]|<Section[\s>]/);
    });
});
