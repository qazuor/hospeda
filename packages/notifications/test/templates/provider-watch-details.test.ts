import { describe, expect, it } from 'vitest';
import { translateProviderWatchDetail } from '../../src/templates/billing/provider-watch-details.js';

describe('HOS-2580 §F translateProviderWatchDetail', () => {
    it.each([
        ['removed: body.status (string)', 'Campo eliminado: body.status (string)'],
        ['added: body.payer_mail (string)', 'Campo nuevo: body.payer_mail (string)'],
        ['retyped: body.total (number -> string)', 'Cambió el tipo: body.total (number -> string)'],
        [
            'collapsed: body.paging (object -> null)',
            'Pasó a venir vacío (null): body.paging (object -> null)'
        ],
        [
            'expanded: body.paging (null -> object)',
            'Dejó de venir vacío (null): body.paging (null -> object)'
        ],
        ['new request: search', 'Pedido nuevo: search'],
        ['request no longer observed: get', 'Pedido que ya no se observa: get'],
        [
            'no accepted baseline for this measurement: review and accept its shape',
            'Esta medición no tiene una forma aceptada: revisala y aceptala en el panel.'
        ]
    ])('translates %j', (line, expected) => {
        expect(translateProviderWatchDetail({ line })).toBe(expected);
    });

    it.each([
        'bad paging.total',
        'WATCH_TIMEOUT: the provider did not answer',
        'constructor: x',
        ': leading separator'
    ])('falls back to the raw line for %j', (line) => {
        expect(translateProviderWatchDetail({ line })).toBe(line);
    });
});
