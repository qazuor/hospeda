/**
 * HOS-2410 web-ui §2 and §8 (AC-1, AC-2, AC-3) — the audience preselection
 * island, with the session and the row reads mocked.
 */

import { PermissionEnum } from '@repo/schemas';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    readCachedAuthMe: vi.fn(),
    fetchAuthMe: vi.fn(),
    tradeMine: vi.fn(),
    partnerMine: vi.fn()
}));

vi.mock('../../../../src/lib/auth-cache', () => ({
    readCachedAuthMe: mocks.readCachedAuthMe,
    fetchAuthMe: mocks.fetchAuthMe
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    hostTradesApi: { mine: mocks.tradeMine },
    partnersApi: { mine: mocks.partnerMine }
}));

import { HelpAudiencePreselect } from '../../../../src/components/account/help/HelpAudiencePreselect.client';
import { HELP_SELECT_AUDIENCE_EVENT } from '../../../../src/lib/help/help-audience';
import {
    HELP_READER_WITHOUT_AUDIENCE_EVENT,
    isReaderWithoutAudience
} from '../../../../src/lib/help/help-audience-shared';

const session = (permissions: readonly string[]) => ({
    isAuthenticated: true,
    user: { id: 'u1', name: 'U', email: 'u@example.test' },
    permissions,
    roles: [],
    cachedAt: Date.now()
});

const noRow = {
    trade: { ok: true, data: { trade: null } },
    partner: { ok: true, data: { partner: null } }
};

describe('HelpAudiencePreselect', () => {
    const selected = vi.fn();
    const onSelect = (event: Event) => selected((event as CustomEvent).detail.audience);

    beforeEach(() => {
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/');
        window.addEventListener(HELP_SELECT_AUDIENCE_EVENT, onSelect);
        mocks.fetchAuthMe.mockResolvedValue(session([]));
        mocks.tradeMine.mockResolvedValue(noRow.trade);
        mocks.partnerMine.mockResolvedValue(noRow.partner);
    });

    afterEach(() => {
        document.documentElement.removeAttribute('data-help-reader-without-audience');
        window.removeEventListener(HELP_SELECT_AUDIENCE_EVENT, onSelect);
        vi.clearAllMocks();
        selected.mockReset();
    });

    it('selects venue for a VENUE_EDIT_OWN user and writes ?para= (AC-1)', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(session([PermissionEnum.VENUE_EDIT_OWN]));

        // Act
        render(<HelpAudiencePreselect />);

        // Assert
        await waitFor(() => expect(selected).toHaveBeenCalledWith('venue'));
        expect(new URL(window.location.href).searchParams.get('para')).toBe('venue');
        expect(mocks.tradeMine).not.toHaveBeenCalled();
    });

    it('selects host for a host who is also a provider (AC-2)', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(session([PermissionEnum.ACCOMMODATION_CREATE]));
        mocks.tradeMine.mockResolvedValue({ ok: true, data: { trade: { id: 't1' } } });

        // Act
        render(<HelpAudiencePreselect />);

        // Assert
        await waitFor(() => expect(selected).toHaveBeenCalledWith('host'));
    });

    it('selects provider from a host-trade row when no permission matched', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(null);
        mocks.tradeMine.mockResolvedValue({ ok: true, data: { trade: { id: 't1' } } });

        // Act
        render(<HelpAudiencePreselect />);

        // Assert
        await waitFor(() => expect(selected).toHaveBeenCalledWith('provider'));
        expect(mocks.fetchAuthMe).toHaveBeenCalled();
    });

    it('does nothing when ?para= is already in the URL (AC-3)', async () => {
        // Arrange
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/?para=partner');
        mocks.readCachedAuthMe.mockReturnValue(session([PermissionEnum.VENUE_EDIT_OWN]));

        // Act
        render(<HelpAudiencePreselect />);
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Assert
        expect(selected).not.toHaveBeenCalled();
        expect(mocks.readCachedAuthMe).not.toHaveBeenCalled();
        expect(new URL(window.location.href).searchParams.get('para')).toBe('partner');
    });

    it('treats an invalid ?para= as absent, like the server (falls back, then preselects)', async () => {
        // Arrange
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/?para=garbage');
        mocks.readCachedAuthMe.mockReturnValue(session([PermissionEnum.VENUE_EDIT_OWN]));

        // Act
        render(<HelpAudiencePreselect />);

        // Assert
        await waitFor(() => expect(selected).toHaveBeenCalledWith('venue'));
        expect(new URL(window.location.href).searchParams.get('para')).toBe('venue');
    });

    it('keeps the default on a failed read, with no error', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(null);
        mocks.fetchAuthMe.mockRejectedValue(new Error('network'));

        // Act
        const { container } = render(<HelpAudiencePreselect />);
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Assert
        expect(selected).not.toHaveBeenCalled();
        expect(window.location.search).toBe('');
        expect(container.innerHTML).toBe('');
    });

    it('keeps the default when a row read fails', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(session([]));
        mocks.tradeMine.mockResolvedValue({ ok: false, error: { status: 500 } });
        mocks.partnerMine.mockResolvedValue({ ok: false, error: { status: 500 } });

        // Act
        render(<HelpAudiencePreselect />);
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Assert
        expect(selected).not.toHaveBeenCalled();
    });

    it('announces a pure tourist (every read ok, nothing matched) and selects nothing', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(session(['accommodation.review.create']));
        const announced = vi.fn();
        window.addEventListener(HELP_READER_WITHOUT_AUDIENCE_EVENT, announced);

        // Act
        render(<HelpAudiencePreselect />);

        // Assert
        await waitFor(() => expect(announced).toHaveBeenCalledTimes(1));
        expect(isReaderWithoutAudience()).toBe(true);
        expect(selected).not.toHaveBeenCalled();
        expect(window.location.search).toBe('');
        window.removeEventListener(HELP_READER_WITHOUT_AUDIENCE_EVENT, announced);
    });

    it('does not announce a tourist when a row read failed (could be a provider)', async () => {
        // Arrange
        mocks.readCachedAuthMe.mockReturnValue(session([]));
        mocks.tradeMine.mockResolvedValue({ ok: false, error: { status: 500 } });

        // Act
        render(<HelpAudiencePreselect />);
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Assert
        expect(isReaderWithoutAudience()).toBe(false);
    });
});
