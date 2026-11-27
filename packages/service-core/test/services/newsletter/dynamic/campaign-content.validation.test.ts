import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveCampaignContentWithReport } from '../../../../src/services/newsletter/dynamic/campaign-content.js';
import { ServiceError } from '../../../../src/types/index.js';
import { dynamicDocument, dynamicPort } from './content.fixtures.js';

describe('campaign content validation', () => {
    it('still rejects invalid dynamic configuration inside an editor-compatible document', async () => {
        const doc = dynamicDocument();
        await expect(
            resolveCampaignContentWithReport({
                doc: {
                    ...doc,
                    content: [
                        { type: 'paragraph', attrs: { textAlign: null } },
                        {
                            type: 'dynamicBlock',
                            attrs: {
                                blockKey: 'newest-block',
                                config: JSON.stringify({ count: 999 })
                            }
                        }
                    ]
                },
                port: dynamicPort(),
                now: new Date()
            })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            reason: 'INVALID_DYNAMIC_BLOCK'
        });
    });
    it('normalizes duplicate block keys to a typed validation error', async () => {
        const doc = dynamicDocument();
        const block = doc.content[1];
        const result = resolveCampaignContentWithReport({
            doc: { ...doc, content: [...doc.content, block] },
            port: dynamicPort(),
            now: new Date('2026-11-26T12:00:00Z')
        });
        await expect(result).rejects.toBeInstanceOf(ServiceError);
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            reason: 'INVALID_DYNAMIC_BLOCK'
        });
    });
});
