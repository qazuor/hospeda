import { afterEach, describe, expect, it } from 'vitest';
import {
    _resetActionReasonResolver,
    resolveServiceActionReason,
    setActionReasonResolver
} from '../../src/utils/action-reason';

describe('resolveServiceActionReason (ACC:15, HOS-1493)', () => {
    afterEach(() => {
        _resetActionReasonResolver();
    });

    it('prefers ctx.actionReason over the wired resolver', () => {
        // Arrange
        setActionReasonResolver(() => 'from resolver');

        // Act
        const result = resolveServiceActionReason({ ctx: { actionReason: 'from ctx' } });

        // Assert
        expect(result).toEqual({ reason: 'from ctx' });
    });

    it('falls back to the wired resolver when the ctx carries none', () => {
        // Arrange
        setActionReasonResolver(() => 'from resolver');

        // Act
        const result = resolveServiceActionReason({ ctx: {} });

        // Assert
        expect(result).toEqual({ reason: 'from resolver' });
    });

    it('returns null when neither the ctx nor a resolver carries a reason', () => {
        // Act
        const result = resolveServiceActionReason({});

        // Assert
        expect(result).toEqual({ reason: null });
    });

    it('trims the reason', () => {
        // Act
        const result = resolveServiceActionReason({ ctx: { actionReason: '  pedido  ' } });

        // Assert
        expect(result).toEqual({ reason: 'pedido' });
    });

    it('treats a blank ctx reason as absent and falls back to the resolver', () => {
        // Arrange
        setActionReasonResolver(() => '   ');

        // Act
        const blankBoth = resolveServiceActionReason({ ctx: { actionReason: '   ' } });
        setActionReasonResolver(() => ' llamada ');
        const blankCtx = resolveServiceActionReason({ ctx: { actionReason: '' } });

        // Assert
        expect(blankBoth).toEqual({ reason: null });
        expect(blankCtx).toEqual({ reason: 'llamada' });
    });

    it('stops reading the resolver after a reset', () => {
        // Arrange
        setActionReasonResolver(() => 'from resolver');

        // Act
        _resetActionReasonResolver();
        const result = resolveServiceActionReason({ ctx: {} });

        // Assert
        expect(result).toEqual({ reason: null });
    });
});
