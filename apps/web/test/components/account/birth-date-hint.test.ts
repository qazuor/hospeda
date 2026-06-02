/**
 * @file birth-date-hint.test.ts
 * @description Confirms both birth-date inputs (profile completion + profile
 * edit) expose the dd/mm/yyyy format hint and the es-AR locale attribute
 * introduced as part of the SPEC-113 follow-up.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const profileCompletion = readFileSync(
    resolve(__dirname, '../../../src/components/account/ProfileCompletionBasicFields.tsx'),
    'utf8'
);

const profileEdit = readFileSync(
    resolve(__dirname, '../../../src/components/account/ProfileEditPersonalSection.tsx'),
    'utf8'
);

function birthDateBlock(src: string): string {
    // Pull the JSX block that starts at `id="(pc-)?birthDate"` and runs
    // through the closing tag so the assertions live near the input.
    const match = src.match(/id=(?:"pc-birthDate"|"birthDate")[\s\S]*?\/>/);
    return match?.[0] ?? '';
}

describe('birth-date input (SPEC-113 dd/mm/yyyy hint)', () => {
    it('ProfileCompletion birth-date input uses text mask (dd/mm/yyyy)', () => {
        // Commit 43b06d2a9 ("fix(web): force dd/mm/yyyy birth date input with
        // paired calendar popover") deliberately changed the ProfileCompletion
        // birth-date input from type="date" (with lang="es-AR") to type="text"
        // with a dd/mm/yyyy mask. The lang attribute is no longer needed or present;
        // assert the text-mask approach instead.
        const block = birthDateBlock(profileCompletion);
        expect(block).toContain('type="text"');
    });

    it('ProfileCompletion hint mentions dd/mm/yyyy', () => {
        expect(profileCompletion).toContain('dd/mm/yyyy');
    });

    it('ProfileEdit birth-date input declares lang="es-AR"', () => {
        const block = birthDateBlock(profileEdit);
        expect(block).toContain('lang="es-AR"');
    });

    it('ProfileEdit hint mentions dd/mm/yyyy', () => {
        expect(profileEdit).toContain('dd/mm/yyyy');
    });
});
