import { afterEach, describe, expect, it, vi } from 'vitest';

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({ apiLogger: { info, warn } }));

import { ApiEnvBaseSchema } from '../../src/utils/env-schema';
import { createMercadoPagoTrafficGovernor } from '../../src/utils/mp-traffic-governor';

afterEach(() => vi.clearAllMocks());

describe('Mercado Pago traffic governor composition', () => {
    it('supports off, observe, and enforce without constructing Redis outside enforce (kills mode degradation)', () => {
        expect(createMercadoPagoTrafficGovernor({ mode: 'off' })).toBeUndefined();
        const observe = createMercadoPagoTrafficGovernor({ mode: 'observe' });
        expect(observe).toMatchObject({ mode: 'observe' });
        const enforce = createMercadoPagoTrafficGovernor({ mode: 'enforce' });
        expect(enforce).toMatchObject({ mode: 'enforce' });
        expect(warn).not.toHaveBeenCalled();
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

    it('warns on every interactive 429 and captures once per capability and window', () => {
        let now = 0;
        const governor = createMercadoPagoTrafficGovernor({ mode: 'observe', now: () => now });
        const rejected = (capability: 'read' | 'authorize') =>
            governor?.observe({
                trafficClass: 'interactive',
                capability,
                status: 429,
                retryAfterMs: 1000
            });
        rejected('read');
        rejected('read');
        rejected('read');
        rejected('authorize');
        expect(warn).toHaveBeenCalledTimes(4);
        expect(warn.mock.calls.filter((call) => call[2]?.capture === true)).toHaveLength(2);
        now = 60_000;
        rejected('read');
        expect(warn).toHaveBeenCalledTimes(5);
        expect(warn.mock.calls.filter((call) => call[2]?.capture === true)).toHaveLength(3);
        governor?.flushWindow();
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
