import { describe, expect, test } from 'bun:test';
import { parseBacklogDraft } from '../src/lib/linear-backlog.ts';

const config = {
    projectId: 'hospeda',
    issues: {
        teamKey: 'HOS',
        backlogState: 'Backlog',
        defaultLabels: ['QAZUOR'],
        commandLabel: 'agent-reported',
        defaultPriority: 4
    }
};

describe('linear backlog draft', () => {
    test('builds a plan without contacting Linear or exposing credentials', () => {
        const result = parseBacklogDraft(
            [
                '--title',
                'Título',
                '--description',
                'Detalle',
                '--kind',
                'bug',
                '--label',
                'area-api'
            ],
            'hospeda',
            config
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.draft.teamKey).toBe('HOS');
            expect(result.draft.labels).toEqual(['QAZUOR', 'agent-reported', 'Bug', 'area-api']);
            expect(result.draft.priority).toBe(4);
        }
    });

    test('rejects incomplete or unsafe input before any network request', () => {
        expect(parseBacklogDraft(['--title', 'Sólo título'], 'hospeda', config).ok).toBe(false);
        expect(
            parseBacklogDraft(
                ['--title', 'T', '--description', 'D', '--priority', '8'],
                'hospeda',
                config
            ).ok
        ).toBe(false);
        expect(
            parseBacklogDraft(
                ['--title', 'T', '--description', 'D', '--kind', 'unknown'],
                'hospeda',
                config
            ).ok
        ).toBe(false);
    });
});
