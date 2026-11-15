// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { GRANT_REFUSAL_KEYS } from '../../grant-refusals';
import { GrantRefusal } from '../GrantRefusal';

const t = (key: string) => {
    let value: unknown = es;
    for (const part of key.replace('admin-billing.', '').split('.'))
        value =
            typeof value === 'object' && value
                ? (value as Record<string, unknown>)[part]
                : undefined;
    return typeof value === 'string' ? value : key;
};
vi.mock('@/hooks/use-translations', () => ({ useTranslations: () => ({ t }) }));

describe('AC:B13a:6 — grant refusal copy (support)', () => {
    const cases: ReadonlyArray<readonly [number, string]> = [
        [403, 'ADMINISTRATIVE_ACTION_FORBIDDEN'],
        [404, 'PERMANENT_GRANT_NOT_FOUND'],
        [422, 'PERMANENT_GRANT_NOT_LIVE'],
        [409, 'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED'],
        [409, 'PERMANENT_GRANT_ALREADY_LIVE'],
        [422, 'PERMANENT_GRANT_REFERENCE_NOT_FOUND'],
        [422, 'PERMANENT_GRANT_FLOOR_NOT_CURRENT'],
        [409, 'PERMANENT_GRANT_LISTING_SOFT_DELETED'],
        [422, 'INVALID_PERMANENT_GRANT_INPUT']
    ];
    it.each(cases)('shows the specific copy for HTTP %i / %s', (status, reason) => {
        const error = new ApiError('refused', {
            status,
            body: { success: false, error: { reason } }
        });
        render(<GrantRefusal error={error} />);
        expect(screen.getByTestId('permanent-grant-refusal')).toHaveTextContent(
            t(GRANT_REFUSAL_KEYS[reason])
        );
        expect(screen.getByTestId('permanent-grant-refusal')).not.toHaveTextContent(
            'INTERNAL_ERROR'
        );
    });
});
