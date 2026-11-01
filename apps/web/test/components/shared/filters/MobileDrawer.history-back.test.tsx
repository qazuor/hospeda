/**
 * @file MobileDrawer.history-back.test.tsx
 * @description The filters drawer closes on the back gesture instead of
 * leaving the listing (HOS-1927).
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileDrawer } from '../../../../src/components/shared/filters/components/MobileDrawer';
import { resetDialogHistoryForTests } from '../../../../src/lib/dialog-history';

const PAGE_URL = 'http://localhost:3000/es/alojamientos/';

function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

describe('MobileDrawer back gesture (HOS-1927)', () => {
    beforeEach(async () => {
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        await settle();
    });

    afterEach(async () => {
        resetDialogHistoryForTests();
        await settle();
    });

    it('opening claims an entry and back closes the drawer', async () => {
        const onClose = vi.fn();
        const before = window.history.length;
        render(
            <MobileDrawer
                isOpen={true}
                onClose={onClose}
                ariaLabel="Filtros"
            >
                <button type="button">x</button>
            </MobileDrawer>
        );
        await settle();
        expect(window.history.length).toBe(before + 1);

        window.history.back();
        await settle();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(window.location.href).toBe(PAGE_URL);
    });

    it('closing through the UI removes the entry it claimed', async () => {
        const onClose = vi.fn();
        const goSpy = vi.spyOn(window.history, 'go');
        const { rerender } = render(
            <MobileDrawer
                isOpen={true}
                onClose={onClose}
                ariaLabel="Filtros"
            >
                <button type="button">x</button>
            </MobileDrawer>
        );
        await settle();

        rerender(
            <MobileDrawer
                isOpen={false}
                onClose={onClose}
                ariaLabel="Filtros"
            >
                <button type="button">x</button>
            </MobileDrawer>
        );
        await settle();

        expect(goSpy).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
        goSpy.mockRestore();
    });
});
