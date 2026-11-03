import { afterEach, describe, expect, it, vi } from 'vitest';

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({ apiLogger: { info, warn } }));

import { ApiEnvBaseSchema } from '../../src/utils/env-schema';
import { createMercadoPagoTrafficGovernor } from '../../src/utils/mp-traffic-governor';

afterEach(() => vi.clearAllMocks());

describe('Mercado Pago traffic governor composition', () => {
    it('supports off, observe, and enforce degradation with one warning (kills enforce activation before PR-3)', () => {
        expect(createMercadoPagoTrafficGovernor({ mode: 'off' })).toBeUndefined();
        const observe = createMercadoPagoTrafficGovernor({ mode: 'observe' });
        expect(observe).toMatchObject({ mode: 'observe' });
        const enforce = createMercadoPagoTrafficGovernor({ mode: 'enforce' });
        expect(enforce).toMatchObject({ mode: 'observe' });
        expect(warn).toHaveBeenCalledTimes(1);
        observe?.stop();
        enforce?.stop();
    });

    it('accepts the three modes, defaults to observe, and rejects unknown values (kills invalid env acceptance)', () => {
        const schema = ApiEnvBaseSchema.shape.HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE;
        expect(schema.parse(undefined)).toBe('observe');
        expect(schema.parse('off')).toBe('off');
        expect(schema.parse('enforce')).toBe('enforce');
        expect(schema.safeParse('on').success).toBe(false);
    });

    it('logs window records and captures only interactive 429s (kills missing observability wiring)', () => {
        const governor = createMercadoPagoTrafficGovernor({ mode: 'observe' });
        governor?.observe({
            trafficClass: 'interactive',
            capability: 'read',
            status: 429,
            retryAfterMs: 1000
        });
        governor?.observe({
            trafficClass: 'background',
            capability: 'read',
            status: 429,
            retryAfterMs: 1000
        });
        governor?.flushWindow();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('interactive') }),
            undefined,
            { capture: true }
        );
        expect(info).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'mp_traffic_window',
                byCapability: expect.any(Object)
            })
        );
        governor?.stop();
    });
});
