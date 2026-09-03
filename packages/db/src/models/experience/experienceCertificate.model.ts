import type { ExperienceCertificate } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { experienceCertificates } from '../../schemas/experience/experience_certificate.dbschema.ts';

/**
 * ExperienceCertificateModel — DB access for issued experience certificates
 * (HOS-1057).
 *
 * A thin `BaseModelImpl` wrapper, like `ExperienceFaqModel`: every read this
 * entity has is "the certificates of one listing", which the base's `findAll`
 * expresses directly. Ordering (newest issued first) is applied by the caller.
 */
export class ExperienceCertificateModel extends BaseModelImpl<ExperienceCertificate> {
    protected table = experienceCertificates;
    public entityName = 'experienceCertificates';

    protected getTableName(): string {
        return 'experienceCertificates';
    }
}

/** Singleton instance of ExperienceCertificateModel for use across the application. */
export const experienceCertificateModel = new ExperienceCertificateModel();
