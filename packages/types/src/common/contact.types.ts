import type { PreferedContactEnum } from '../enums/contact-preference.enum.js';

export interface ContactInfoType {
    personalEmail?: string;
    workEmail?: string;
    homePhone?: string;
    workPhone?: string;
    mobilePhone: string;
    website?: string;
    preferredEmail?: PreferedContactEnum;
    preferredPhone?: PreferedContactEnum;
}
