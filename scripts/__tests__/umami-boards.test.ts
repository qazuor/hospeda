import { describe, expect, it } from 'vitest';
import {
    BOARD_SPECS,
    buildBoardDefinitions,
    DROPPED_TILES,
    listReferencedReportNames
} from '../umami/boards.js';
import { buildReportDefinitions, UmamiDefinitionError } from '../umami/definitions.js';

const WEBSITE_ID = '07b2a9cf-a599-4632-8fae-09ba4988a2e3';

function idsFor(names: readonly string[]): Record<string, string> {
    return Object.fromEntries(names.map((name, index) => [name, `id-${index}`]));
}

function allReportIds(): Record<string, string> {
    return idsFor(buildReportDefinitions().map((report) => report.name));
}

interface ParsedComponent {
    readonly type: string;
    readonly props?: { readonly reportId?: string; readonly type?: string };
}

function componentsOf(board: { readonly parameters: { readonly [key: string]: unknown } }) {
    const rows = board.parameters['rows'] as readonly {
        readonly columns: readonly { readonly component: ParsedComponent }[];
    }[];
    return rows.flatMap((row) => row.columns.map((column) => column.component));
}

describe('buildBoardDefinitions', () => {
    it('should build the six boards with the stable dashboard names', () => {
        const boards = buildBoardDefinitions({ websiteId: WEBSITE_ID, reportIds: allReportIds() });
        expect(boards.map((board) => board.name)).toEqual([
            '00 Resumen',
            '01 Adquisición',
            '02 Descubrimiento',
            '03 Owners',
            '04 Suscripciones',
            '05 Calidad'
        ]);
        for (const board of boards) {
            expect(board.type).toBe('website');
            expect(board.parameters['websiteId']).toBe(WEBSITE_ID);
        }
    });

    it('should use the expected component types per dashboard', () => {
        const boards = buildBoardDefinitions({ websiteId: WEBSITE_ID, reportIds: allReportIds() });
        const typesByName = Object.fromEntries(
            boards.map((board) => [
                board.name,
                new Set(componentsOf(board).map((component) => component.type))
            ])
        );
        expect(typesByName['00 Resumen']).toEqual(
            new Set(['WebsiteMetricsBar', 'WebsiteChart', 'Goal', 'Funnel'])
        );
        expect(typesByName['01 Adquisición']).toEqual(
            new Set(['WebsiteMetricsBar', 'WebsiteChart', 'MetricsTable', 'Goal'])
        );
        expect(typesByName['02 Descubrimiento']).toEqual(
            new Set(['EventsMetricsBar', 'EventsChart', 'MetricsTable', 'Goal', 'Funnel'])
        );
        expect(typesByName['03 Owners']).toEqual(
            new Set(['EventsMetricsBar', 'EventsChart', 'MetricsTable', 'Goal', 'Funnel'])
        );
        expect(typesByName['04 Suscripciones']).toEqual(
            new Set(['EventsMetricsBar', 'EventsChart', 'MetricsTable', 'Goal', 'Funnel'])
        );
        expect(typesByName['05 Calidad']).toEqual(
            new Set(['EventsChart', 'MetricsTable', 'Funnel'])
        );
    });

    it('should resolve every Funnel and Goal reportId from the map', () => {
        const reportIds = allReportIds();
        const known = new Set(Object.values(reportIds));
        const boards = buildBoardDefinitions({ websiteId: WEBSITE_ID, reportIds });
        const linked = boards
            .flatMap(componentsOf)
            .filter((component) => component.type === 'Funnel' || component.type === 'Goal');
        expect(linked.length).toBeGreaterThan(0);
        for (const component of linked) {
            expect(known.has(component.props?.reportId ?? '')).toBe(true);
        }
    });

    it('should throw UNRESOLVED_REPORT when a referenced report has no id', () => {
        const reportIds = allReportIds();
        const [missing] = listReferencedReportNames();
        delete reportIds[missing as string];
        try {
            buildBoardDefinitions({ websiteId: WEBSITE_ID, reportIds });
            throw new Error('expected the build to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(UmamiDefinitionError);
            expect((error as UmamiDefinitionError).code).toBe('UNRESOLVED_REPORT');
            expect((error as UmamiDefinitionError).detail).toBe(missing);
        }
    });

    it('should be deterministic and JSON-stable', () => {
        const input = { websiteId: WEBSITE_ID, reportIds: allReportIds() };
        const first = JSON.stringify(buildBoardDefinitions(input));
        expect(JSON.stringify(buildBoardDefinitions(input))).toBe(first);
    });
});

describe('board report references', () => {
    it('should only reference reports that buildReportDefinitions creates, with the right type', () => {
        const reports = new Map(
            buildReportDefinitions().map((report) => [report.name, report.type])
        );
        for (const spec of BOARD_SPECS) {
            for (const component of spec.rows.flat()) {
                if (component.kind === 'funnel') {
                    expect(reports.get(component.reportName)).toBe('funnel');
                }
                if (component.kind === 'goal') {
                    expect(reports.get(component.reportName)).toBe('goal');
                }
            }
        }
    });

    it('should list referenced report names without duplicates', () => {
        const names = listReferencedReportNames();
        expect(new Set(names).size).toBe(names.length);
        expect(names.length).toBeGreaterThan(0);
    });

    it('should use every funnel of the catalog (5 distinct, not 9) on some board', () => {
        const funnels = buildReportDefinitions().filter((report) => report.type === 'funnel');
        expect(funnels).toHaveLength(5);
        const referenced = new Set(listReferencedReportNames());
        for (const funnel of funnels) expect(referenced.has(funnel.name)).toBe(true);
    });
});

describe('DROPPED_TILES', () => {
    it('should document each dropped tile with a reason and a replacement', () => {
        expect(DROPPED_TILES.length).toBeGreaterThan(0);
        const boardNames = new Set(BOARD_SPECS.map((spec) => spec.name));
        for (const tile of DROPPED_TILES) {
            expect(boardNames.has(tile.dashboard)).toBe(true);
            expect(tile.tile.length).toBeGreaterThan(0);
            expect(tile.reason.length).toBeGreaterThan(0);
            expect(tile.replacement.length).toBeGreaterThan(0);
        }
    });

    it('should cover the event-property and person-property breakdowns', () => {
        const names = DROPPED_TILES.map((tile) => tile.tile);
        expect(names).toContain('Publicaciones por plan');
        expect(names).toContain('Suscripciones por plan');
        expect(names).toContain('Pagos fallidos por categoría');
    });
});
