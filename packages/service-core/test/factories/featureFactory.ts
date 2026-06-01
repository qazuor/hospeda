import type { Feature, FeatureIdType, UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Factory builder for Feature, for use in tests.
 * Ensures all required fields are present and provides sensible defaults.
 *
 * The `name` and `description` fields are now I18nText objects (`{es, en, pt}`)
 * matching the JSONB DB column. All three locales default to the same test value
 * as a placeholder (real translations are a content task).
 */
export class FeatureFactoryBuilder {
    private feature: Feature;

    constructor() {
        this.feature = {
            id: getMockId('feature') as FeatureIdType,
            slug: 'test-feature',
            name: { es: 'Test Feature', en: 'Test Feature', pt: 'Test Feature' },
            description: {
                es: 'A test feature description',
                en: 'A test feature description',
                pt: 'A test feature description'
            },
            icon: '⭐',
            isBuiltin: false,
            isFeatured: false,
            displayWeight: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: { favorite: false }
        };
    }

    with(values: Partial<Feature>): FeatureFactoryBuilder {
        this.feature = { ...this.feature, ...values };
        return this;
    }

    build(): Feature {
        return { ...this.feature };
    }

    static create(values: Partial<Feature> = {}): Feature {
        return new FeatureFactoryBuilder().with(values).build();
    }
}
