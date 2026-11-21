/**
 * HOS-2403: the MCP `get_my_plan` view renders an unlimited limit as
 * `unlimited`, whether the effective set carries `Infinity` or the catalog
 * sentinel 2147483647 (and never a number at or above it).
 *
 * Type: unit. `labelView` is a pure mapping of an effective-set view.
 */
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { labelView } from '../../../../src/mcp/tools/plan/my-plan-labels';

const SENTINEL = 2147483647;

function view(limits: Record<string, number | 'Infinity'>) {
    return {
        userId: 'user-1',
        vertical: VerticalEnum.TOURIST,
        hasLiveNonTrialTitle: true,
        entitlements: {},
        limits
    };
}

describe('HOS-2403 — labelView never leaks the unlimited sentinel as a number', () => {
    it('renders the sentinel as unlimited', () => {
        // Arrange
        const input = view({ max_favorites: SENTINEL });

        // Act
        const { limits } = labelView(input, 'es');

        // Assert
        expect(limits.map((limit) => limit.value)).toStrictEqual(['unlimited']);
    });

    it('renders a value above the sentinel as unlimited, never as 2147483652', () => {
        const { limits } = labelView(view({ max_favorites: SENTINEL + 5 }), 'es');

        expect(limits.map((limit) => limit.value)).toStrictEqual(['unlimited']);
    });

    it('still renders Infinity as unlimited and finite values as is (210 stays)', () => {
        const { limits } = labelView(
            view({ max_active_alerts: 'Infinity', max_ai_chat_consumer_per_month: 210 }),
            'es'
        );

        expect(limits.map((limit) => limit.value)).toStrictEqual(['unlimited', 210]);
    });
});
