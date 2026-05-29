/**
 * @file UsageProgressBar.test.tsx
 * @description Unit + render tests for the standalone UsageProgressBar
 * component added in SPEC-156 PR-4 (T-035). Covers:
 *   - threshold transitions per AC-9 (default → warning at 80 %, danger at 95 %)
 *   - clamping above 100 % and below 0 %
 *   - unlimited rendering when `limit` is null
 *   - accessibility attributes on the progress role.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    UsageProgressBar,
    computeUsagePercent,
    pickUsageTone
} from '../../../src/components/billing/UsageProgressBar';

describe('computeUsagePercent', () => {
    it('returns 0 for null limit', () => {
        expect(computeUsagePercent(10, null)).toBe(0);
    });

    it('returns 0 for non-positive limit', () => {
        expect(computeUsagePercent(10, 0)).toBe(0);
        expect(computeUsagePercent(10, -5)).toBe(0);
    });

    it('returns 0 for non-positive usage', () => {
        expect(computeUsagePercent(0, 10)).toBe(0);
        expect(computeUsagePercent(-1, 10)).toBe(0);
    });

    it('rounds to one decimal place', () => {
        expect(computeUsagePercent(1, 3)).toBe(33.3);
        expect(computeUsagePercent(2, 3)).toBe(66.7);
    });

    it('clamps to 100 when used >= limit', () => {
        expect(computeUsagePercent(10, 10)).toBe(100);
        expect(computeUsagePercent(15, 10)).toBe(100);
    });
});

describe('pickUsageTone (AC-9 thresholds)', () => {
    it('returns "default" below 80 %', () => {
        expect(pickUsageTone(0)).toBe('default');
        expect(pickUsageTone(50)).toBe('default');
        expect(pickUsageTone(79.9)).toBe('default');
    });

    it('returns "warning" exactly at 80 % and up to 94.9 %', () => {
        expect(pickUsageTone(80)).toBe('warning');
        expect(pickUsageTone(85)).toBe('warning');
        expect(pickUsageTone(94.9)).toBe('warning');
    });

    it('returns "danger" exactly at 95 % and above', () => {
        expect(pickUsageTone(95)).toBe('danger');
        expect(pickUsageTone(99.9)).toBe('danger');
        expect(pickUsageTone(100)).toBe('danger');
    });
});

describe('<UsageProgressBar /> rendering', () => {
    it('renders the label + numeric ratio when limited', () => {
        render(
            <UsageProgressBar
                label="Alojamientos"
                used={3}
                limit={5}
                unit="alojamientos"
            />
        );
        expect(screen.getByText('Alojamientos')).toBeDefined();
        // Default unitOfLimit fallback when caller does not pass an i18n one
        expect(screen.getByText('3 / 5 alojamientos')).toBeDefined();
    });

    it('uses the unitOfLimitLabel when provided (i18n hook)', () => {
        render(
            <UsageProgressBar
                label="Alojamientos"
                used={3}
                limit={5}
                unitOfLimitLabel="3 de 5"
            />
        );
        expect(screen.getByText('3 de 5')).toBeDefined();
    });

    it('does NOT render the progress role when the limit is unlimited (null)', () => {
        render(
            <UsageProgressBar
                label="Alojamientos"
                used={42}
                limit={null}
                unlimitedLabel="Sin límite"
            />
        );
        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.getByText('Sin límite')).toBeDefined();
    });

    it('exposes aria-valuenow + aria-valuemin/max on the progress role', () => {
        render(
            <UsageProgressBar
                label="Alojamientos"
                used={4}
                limit={10}
            />
        );
        const bar = screen.getByRole('progressbar');
        expect(bar.getAttribute('aria-valuemin')).toBe('0');
        expect(bar.getAttribute('aria-valuemax')).toBe('100');
        expect(bar.getAttribute('aria-valuenow')).toBe('40');
        expect(bar.getAttribute('aria-label')).toBe('Alojamientos');
    });

    it('tags the wrapper with the resolved tone for downstream styling hooks', () => {
        render(
            <UsageProgressBar
                label="Casi al límite"
                used={9}
                limit={10}
            />
        );
        const wrapper = screen.getByTestId('usage-progress-bar');
        // 9 / 10 = 90 % -> warning tone
        expect(wrapper.getAttribute('data-tone')).toBe('warning');
        expect(wrapper.getAttribute('data-percent')).toBe('90');
    });

    it('uses the danger tone at 95 %+ usage', () => {
        render(
            <UsageProgressBar
                label="Lleno"
                used={95}
                limit={100}
            />
        );
        const wrapper = screen.getByTestId('usage-progress-bar');
        expect(wrapper.getAttribute('data-tone')).toBe('danger');
    });

    it('uses the default tone below 80 %', () => {
        render(
            <UsageProgressBar
                label="Tranquilo"
                used={1}
                limit={10}
            />
        );
        const wrapper = screen.getByTestId('usage-progress-bar');
        expect(wrapper.getAttribute('data-tone')).toBe('default');
    });
});
