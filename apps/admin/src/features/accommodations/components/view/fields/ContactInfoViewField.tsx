import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card } from '@/components/ui-wrapped/Card';
import type { ContactInfoFieldData } from '@/features/accommodations/types/accommodation-form.types';

/**
 * Props for ContactInfoViewField component
 */
export type ContactInfoViewFieldProps = {
    /** Contact info data to display */
    data: ContactInfoFieldData;
    /** Whether to show the field in compact mode */
    compact?: boolean;
    /** Additional CSS classes */
    className?: string;
};

/**
 * Contact method item component
 */
type ContactMethodProps = {
    iconName: string;
    label: string;
    value: string;
    href?: string;
    action?: () => void;
    iconColor?: string;
};

function ContactMethod({
    iconName,
    label,
    value,
    href,
    action,
    iconColor = 'text-gray-500'
}: ContactMethodProps) {
    const content = (
        <div className="flex items-center space-x-3">
            <Icon
                name={iconName}
                className={`h-5 w-5 ${iconColor} flex-shrink-0`}
            />
            <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-500 text-xs uppercase tracking-wide">{label}</p>
                <p className="truncate text-gray-900 text-sm">{value}</p>
            </div>
        </div>
    );

    if (href) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
                {content}
            </a>
        );
    }

    if (action) {
        return (
            <button
                type="button"
                onClick={action}
                className="block w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
                {content}
            </button>
        );
    }

    return <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">{content}</div>;
}

/**
 * Specialized view component for contact information fields
 *
 * Displays contact information in an organized, actionable format
 * with clickable links for emails, phones, and social media
 */
export function ContactInfoViewField({
    data,
    compact = false,
    className = ''
}: ContactInfoViewFieldProps) {
    // Helper functions for generating contact URLs
    const getEmailHref = (email: string) => `mailto:${email}`;
    const getPhoneHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;
    const getWhatsAppHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

    if (compact) {
        return (
            <div className={`space-y-2 ${className}`}>
                {/* Primary contact methods */}
                <div className="flex items-center space-x-4">
                    {data.email && (
                        <a
                            href={getEmailHref(data.email)}
                            className="flex items-center space-x-1 text-blue-600 text-sm hover:text-blue-800"
                        >
                            <Icon
                                name="envelope"
                                className="h-4 w-4"
                            />
                            <span>{data.email}</span>
                        </a>
                    )}
                    {data.phone && (
                        <a
                            href={getPhoneHref(data.phone)}
                            className="flex items-center space-x-1 text-green-600 text-sm hover:text-green-800"
                        >
                            <Icon
                                name="phone"
                                className="h-4 w-4"
                            />
                            <span>{data.phone}</span>
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <Card className={`p-6 ${className}`}>
            <div className="space-y-6">
                {/* Primary Contact Methods */}
                <div>
                    <h4 className="mb-3 font-medium text-gray-900 text-sm">Primary Contact</h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {data.email && (
                            <ContactMethod
                                iconName="envelope"
                                label="Email"
                                value={data.email}
                                href={getEmailHref(data.email)}
                                iconColor="text-blue-500"
                            />
                        )}
                        {data.phone && (
                            <ContactMethod
                                iconName="phone"
                                label="Phone"
                                value={data.phone}
                                href={getPhoneHref(data.phone)}
                                iconColor="text-green-500"
                            />
                        )}
                    </div>
                </div>

                {/* Website */}
                {data.website && (
                    <div>
                        <h4 className="mb-3 font-medium text-gray-900 text-sm">Website</h4>
                        <ContactMethod
                            iconName="globe"
                            label="Website"
                            value={data.website}
                            href={data.website}
                            iconColor="text-purple-500"
                        />
                    </div>
                )}

                {/* Contact Person */}
                {(data.contactPersonName || data.contactPersonEmail || data.contactPersonPhone) && (
                    <div>
                        <h4 className="mb-3 font-medium text-gray-900 text-sm">Contact Person</h4>
                        <div className="space-y-3">
                            {data.contactPersonName && (
                                <ContactMethod
                                    iconName="user"
                                    label="Name"
                                    value={data.contactPersonName}
                                    iconColor="text-gray-500"
                                />
                            )}
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {data.contactPersonEmail && (
                                    <ContactMethod
                                        iconName="envelope"
                                        label="Email"
                                        value={data.contactPersonEmail}
                                        href={getEmailHref(data.contactPersonEmail)}
                                        iconColor="text-blue-500"
                                    />
                                )}
                                {data.contactPersonPhone && (
                                    <ContactMethod
                                        iconName="phone"
                                        label="Phone"
                                        value={data.contactPersonPhone}
                                        href={getPhoneHref(data.contactPersonPhone)}
                                        iconColor="text-green-500"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Messaging & Social */}
                {(data.whatsapp || data.instagram || data.facebook) && (
                    <div>
                        <h4 className="mb-3 font-medium text-gray-900 text-sm">
                            Messaging & Social Media
                        </h4>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {data.whatsapp && (
                                <ContactMethod
                                    iconName="chat"
                                    label="WhatsApp"
                                    value={data.whatsapp}
                                    href={getWhatsAppHref(data.whatsapp)}
                                    iconColor="text-green-600"
                                />
                            )}
                            {data.instagram && (
                                <ContactMethod
                                    iconName="globe"
                                    label="Instagram"
                                    value={data.instagram}
                                    href={data.instagram}
                                    iconColor="text-pink-500"
                                />
                            )}
                            {data.facebook && (
                                <ContactMethod
                                    iconName="globe"
                                    label="Facebook"
                                    value={data.facebook}
                                    href={data.facebook}
                                    iconColor="text-blue-600"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="border-gray-200 border-t pt-4">
                    <div className="flex flex-wrap gap-2">
                        {data.email && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(getEmailHref(data.email), '_blank')}
                            >
                                <Icon
                                    name="envelope"
                                    className="mr-1 h-4 w-4"
                                />
                                Send Email
                            </Button>
                        )}
                        {data.phone && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    data.phone && window.open(getPhoneHref(data.phone), '_blank')
                                }
                            >
                                <Icon
                                    name="phone"
                                    className="mr-1 h-4 w-4"
                                />
                                Call
                            </Button>
                        )}
                        {data.whatsapp && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    data.whatsapp &&
                                    window.open(getWhatsAppHref(data.whatsapp), '_blank')
                                }
                            >
                                <Icon
                                    name="chat"
                                    className="mr-1 h-4 w-4"
                                />
                                WhatsApp
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
