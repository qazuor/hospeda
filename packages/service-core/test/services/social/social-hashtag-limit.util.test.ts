import { SocialPlatformEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { checkHashtagLimits } from '../../../src/services/social/social-hashtag-limit.util';

describe('checkHashtagLimits', () => {
    it('returns ok when every platform is under its limit', () => {
        const result = checkHashtagLimits({
            countsByPlatform: { [SocialPlatformEnum.INSTAGRAM]: 10 },
            maxByPlatform: { [SocialPlatformEnum.INSTAGRAM]: 30 }
        });

        expect(result).toEqual({ ok: true });
    });

    it('returns ok when a platform is exactly at its limit', () => {
        const result = checkHashtagLimits({
            countsByPlatform: { [SocialPlatformEnum.X]: 5 },
            maxByPlatform: { [SocialPlatformEnum.X]: 5 }
        });

        expect(result).toEqual({ ok: true });
    });

    it('returns ok when the count is zero', () => {
        const result = checkHashtagLimits({
            countsByPlatform: { [SocialPlatformEnum.FACEBOOK]: 0 },
            maxByPlatform: { [SocialPlatformEnum.FACEBOOK]: 10 }
        });

        expect(result).toEqual({ ok: true });
    });

    it('reports a violation when a platform is one over its limit', () => {
        const result = checkHashtagLimits({
            countsByPlatform: { [SocialPlatformEnum.X]: 6 },
            maxByPlatform: { [SocialPlatformEnum.X]: 5 }
        });

        expect(result).toEqual({
            ok: false,
            violations: [{ platform: SocialPlatformEnum.X, count: 6, max: 5, excessBy: 1 }]
        });
    });

    it('reports violations for multiple platforms independently', () => {
        const result = checkHashtagLimits({
            countsByPlatform: {
                [SocialPlatformEnum.INSTAGRAM]: 35,
                [SocialPlatformEnum.FACEBOOK]: 8,
                [SocialPlatformEnum.X]: 12
            },
            maxByPlatform: {
                [SocialPlatformEnum.INSTAGRAM]: 30,
                [SocialPlatformEnum.FACEBOOK]: 10,
                [SocialPlatformEnum.X]: 5
            }
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.violations).toHaveLength(2);
            expect(result.violations).toContainEqual({
                platform: SocialPlatformEnum.INSTAGRAM,
                count: 35,
                max: 30,
                excessBy: 5
            });
            expect(result.violations).toContainEqual({
                platform: SocialPlatformEnum.X,
                count: 12,
                max: 5,
                excessBy: 7
            });
        }
    });

    it('does not report a violation for a platform with no configured max', () => {
        const result = checkHashtagLimits({
            countsByPlatform: { [SocialPlatformEnum.INSTAGRAM]: 1000 },
            maxByPlatform: {}
        });

        expect(result).toEqual({ ok: true });
    });

    it('ignores platforms present only in maxByPlatform', () => {
        const result = checkHashtagLimits({
            countsByPlatform: {},
            maxByPlatform: { [SocialPlatformEnum.INSTAGRAM]: 30 }
        });

        expect(result).toEqual({ ok: true });
    });
});
