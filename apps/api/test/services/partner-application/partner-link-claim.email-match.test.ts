import { describe, expect, it } from 'vitest';
import { isSameClaimEmail } from '../../../src/services/partner-application/partner-link-claim.service';

/** HOS-2222: the claim link binds a Partner only to the account of the application email. */
describe('isSameClaimEmail', () => {
    it.each([
        { name: 'identical emails', account: 'ana@example.test', application: 'ana@example.test' },
        { name: 'different case', account: 'Ana@Example.TEST', application: 'ana@example.test' },
        {
            name: 'surrounding whitespace',
            account: ' ana@example.test ',
            application: '\tANA@example.test\n'
        }
    ])('matches $name', ({ account, application }) => {
        // Act
        const result = isSameClaimEmail({ accountEmail: account, claimEmail: application });

        // Assert
        expect(result).toEqual({ matches: true });
    });

    it.each([
        {
            name: 'a different mailbox',
            account: 'admin@example.test',
            application: 'ana@example.test'
        },
        { name: 'a null application email', account: 'ana@example.test', application: null },
        { name: 'a blank application email', account: 'ana@example.test', application: '   ' },
        { name: 'a blank account and a null application', account: '', application: null }
    ])('does not match $name', ({ account, application }) => {
        // Act
        const result = isSameClaimEmail({ accountEmail: account, claimEmail: application });

        // Assert
        expect(result).toEqual({ matches: false });
    });
});
