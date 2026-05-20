/**
 * Unit tests for the `buildSupportMailto` helper used by the forbidden page's
 * "Contact support" CTA. The visual rendering of the page is covered by
 * manual / integration testing — these tests focus on the deterministic URL
 * assembly logic.
 */

import { describe, expect, it } from 'vitest';
import { SUPPORT_EMAIL, buildSupportMailto } from '../../src/routes/auth/forbidden.mailto';

const SUBJECT = 'Admin access request';
const BODY_TEMPLATE = 'Hi.\nEmail: {email}\nID: {userId}\nReason: {reason}\nPath: {originalPath}\n';

describe('buildSupportMailto', () => {
    it('targets the canonical support address', () => {
        expect(SUPPORT_EMAIL).toBe('soporte@hospeda.com.ar');
    });

    it('returns a mailto URL aimed at the support recipient', () => {
        const href = buildSupportMailto({
            email: 'lola@example.com',
            userId: 'usr_123',
            reason: 'host-missing-permission',
            originalPath: '/admin',
            subjectLine: SUBJECT,
            bodyTemplate: BODY_TEMPLATE
        });
        expect(href.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
    });

    it('URL-encodes the subject line', () => {
        const href = buildSupportMailto({
            email: 'lola@example.com',
            userId: 'usr_123',
            reason: 'host-missing-permission',
            originalPath: '/admin',
            subjectLine: 'Hola — necesito acceso',
            bodyTemplate: BODY_TEMPLATE
        });
        const url = new URL(href);
        expect(url.searchParams.get('subject')).toBe('Hola — necesito acceso');
    });

    it('substitutes {email}, {userId}, {reason}, and {originalPath} tokens', () => {
        const href = buildSupportMailto({
            email: 'lola@example.com',
            userId: 'usr_123',
            reason: 'generic',
            originalPath: '/admin/billing/plans',
            subjectLine: SUBJECT,
            bodyTemplate: BODY_TEMPLATE
        });
        const url = new URL(href);
        const body = url.searchParams.get('body') ?? '';
        expect(body).toContain('Email: lola@example.com');
        expect(body).toContain('ID: usr_123');
        expect(body).toContain('Reason: generic');
        expect(body).toContain('Path: /admin/billing/plans');
    });

    it('falls back to an em dash for missing values', () => {
        const href = buildSupportMailto({
            email: null,
            userId: null,
            reason: 'generic',
            originalPath: undefined,
            subjectLine: SUBJECT,
            bodyTemplate: BODY_TEMPLATE
        });
        const url = new URL(href);
        const body = url.searchParams.get('body') ?? '';
        expect(body).toContain('Email: —');
        expect(body).toContain('ID: —');
        expect(body).toContain('Path: —');
    });

    it('encodes the host-missing-permission reason verbatim', () => {
        const href = buildSupportMailto({
            email: 'lola@example.com',
            userId: 'usr_123',
            reason: 'host-missing-permission',
            originalPath: '/admin',
            subjectLine: SUBJECT,
            bodyTemplate: BODY_TEMPLATE
        });
        const url = new URL(href);
        const body = url.searchParams.get('body') ?? '';
        expect(body).toContain('Reason: host-missing-permission');
    });
});
