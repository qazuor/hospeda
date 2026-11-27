/**
 * @file delivery-factory-attribution.test.ts
 * @description The newsletter renderers the api injects apply the campaign
 * attribution (HOS-2359 AC-10, AC-13).
 */
import { configureEmailAssets, resetEmailAssets } from '@repo/email';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    attributeCampaignHtml,
    renderAttributedCampaignEmail
} from '../../../src/services/newsletter/delivery-factory';

vi.mock('../../../src/utils/env.js', () => ({ env: {} }));

const SITE_URL = 'https://hospeda.com.ar';
const BODY = `<p>Mirá <a href="${SITE_URL}/es/alojamientos/">los alojamientos</a> y <a href="https://instagram.com/hospeda">Instagram</a>.</p>`;

describe('newsletter renderers with attribution', () => {
    beforeAll(() => {
        configureEmailAssets({ siteUrl: SITE_URL });
    });

    afterAll(() => {
        resetEmailAssets();
    });

    it('adds the campaign UTMs and no pixel to a real send (AC-10, HOS-2583 AC-2)', async () => {
        // Act
        const html = await renderAttributedCampaignEmail({
            subject: 'Otoño',
            bodyHtml: BODY,
            unsubscribeUrl: `${SITE_URL}/es/newsletter/baja?t=x`,
            isTest: false,
            attribution: {
                medium: 'campaign',
                campaignSlug: 'otono-aaaaaaaa'
            }
        });

        // Assert
        expect(html).toContain(
            'utm_source=email&amp;utm_medium=campaign&amp;utm_campaign=otono-aaaaaaaa'
        );
        expect(html).toContain('href="https://instagram.com/hospeda"');
        expect(html).not.toContain('/p/');
    });

    it('renders no pixel for a test send (AC-13)', async () => {
        const html = await renderAttributedCampaignEmail({
            subject: 'Otoño',
            bodyHtml: BODY,
            unsubscribeUrl: `${SITE_URL}/es/newsletter/baja?t=x`,
            isTest: true,
            attribution: { medium: 'campaign', campaignSlug: 'otono-aaaaaaaa' }
        });

        expect(html).toContain('utm_campaign=otono-aaaaaaaa');
        expect(html).not.toContain('/p/');
    });

    it('attributes an already-rendered batch HTML', () => {
        const html = attributeCampaignHtml({
            html: `<html><body>${BODY}</body></html>`,
            attribution: {
                medium: 'campaign',
                campaignSlug: 'otono-aaaaaaaa'
            }
        });

        expect(html).toContain('utm_campaign=otono-aaaaaaaa');
        expect(html).not.toContain('/p/');
    });

    it('forwards dynamic segments to the campaign wrapper before attribution', async () => {
        const html = await renderAttributedCampaignEmail({
            subject: 'Dynamic newsletter',
            bodyHtml: '<p>Legacy fallback must not appear</p>',
            segments: [`<p>Dynamic card <a href="${SITE_URL}/es/alojamientos/cabin/">View</a></p>`],
            unsubscribeUrl: `${SITE_URL}/es/newsletter/baja?t=x`,
            isTest: false,
            attribution: { medium: 'campaign', campaignSlug: 'dynamic-aaaaaaaa' }
        });
        expect(html).toContain('Dynamic card');
        expect(html).not.toContain('Legacy fallback must not appear');
        expect(html).toContain('utm_campaign=dynamic-aaaaaaaa');
    });
});
