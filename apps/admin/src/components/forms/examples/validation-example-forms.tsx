/**
 * Individual validation example form components
 *
 * Separated from ValidationExample.tsx to keep file sizes manageable.
 * Each form demonstrates a different validation pattern.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COMMON_CROSS_FIELD_RULES } from '@/lib/validation/rules/commonRules';
import { COMMON_VALIDATORS } from '@/lib/validation/validators/commonValidators';
import { adminLogger } from '@/utils/logger';
import { useState } from 'react';
import { ValidatedForm } from '../ValidatedForm';
import { VALIDATED_INPUT_PRESETS, ValidatedInput } from '../ValidatedInput';

/**
 * Example form data types
 */
type UserRegistrationForm = {
    readonly email: string;
    readonly username: string;
    readonly password: string;
    readonly confirmPassword: string;
    readonly birthDate: string;
    readonly phone: string;
    readonly website: string;
};

type DateRangeForm = {
    readonly startDate: string;
    readonly endDate: string;
    readonly eventName: string;
};

type ConditionalForm = {
    readonly paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer' | '';
    readonly cardNumber: string;
    readonly billingAddress: string;
    readonly amount: string;
};

/**
 * Mock API validators for demonstration
 */
const mockEmailValidator = async (email: string): Promise<string | null> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const existingEmails = ['admin@example.com', 'user@test.com', 'demo@demo.com'];
    return existingEmails.includes(email.toLowerCase()) ? 'This email is already registered' : null;
};

const mockUsernameValidator = async (username: string): Promise<string | null> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const existingUsernames = ['admin', 'user', 'demo', 'test'];
    if (existingUsernames.includes(username.toLowerCase())) {
        return 'This username is already taken';
    }
    if (username.length < 3) {
        return 'Username must be at least 3 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
};

/**
 * User Registration Form Example
 */
export const UserRegistrationExample = () => {
    const [formData, setFormData] = useState<UserRegistrationForm>({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        birthDate: '',
        phone: '',
        website: ''
    });

    const validationRules = [
        COMMON_CROSS_FIELD_RULES.passwordConfirmation('password', 'confirmPassword'),
        COMMON_CROSS_FIELD_RULES.ageValidation(
            'birthDate',
            18,
            'You must be at least 18 years old to register'
        )
    ];

    const handleSubmit = async (data: UserRegistrationForm) => {
        adminLogger.info('User registration submitted:', JSON.stringify(data, null, 2));
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (Math.random() > 0.3) {
            adminLogger.info('Registration successful');
        } else {
            throw new Error('Registration failed. Please try again.');
        }
    };

    const updateField = <K extends keyof UserRegistrationForm>(
        field: K,
        value: UserRegistrationForm[K]
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Registration Form</CardTitle>
                <p className="text-muted-foreground text-sm">
                    Demonstrates async validation, cross-field validation, and form submission
                </p>
            </CardHeader>
            <CardContent>
                <ValidatedForm
                    formData={formData}
                    validationRules={validationRules}
                    onSubmit={handleSubmit}
                    submitText="Create Account"
                    successMessage="Account created successfully! Welcome aboard."
                    resetOnSuccess={true}
                    onReset={() =>
                        setFormData({
                            email: '',
                            username: '',
                            password: '',
                            confirmPassword: '',
                            birthDate: '',
                            phone: '',
                            website: ''
                        })
                    }
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ValidatedInput
                            {...VALIDATED_INPUT_PRESETS.email}
                            label="Email Address"
                            required
                            value={formData.email}
                            onChange={(value) => updateField('email', value)}
                            asyncValidator={mockEmailValidator}
                            helpText="We'll check if this email is available"
                        />
                        <ValidatedInput
                            {...VALIDATED_INPUT_PRESETS.username}
                            label="Username"
                            required
                            value={formData.username}
                            onChange={(value) => updateField('username', value)}
                            asyncValidator={mockUsernameValidator}
                            helpText="Choose a unique username (3+ characters)"
                        />
                        <ValidatedInput
                            {...VALIDATED_INPUT_PRESETS.password}
                            label="Password"
                            required
                            value={formData.password}
                            onChange={(value) => updateField('password', value)}
                            helpText="Choose a strong password"
                        />
                        <ValidatedInput
                            {...VALIDATED_INPUT_PRESETS.confirmPassword}
                            label="Confirm Password"
                            required
                            value={formData.confirmPassword}
                            onChange={(value) => updateField('confirmPassword', value)}
                            helpText="Re-enter your password"
                        />
                        <ValidatedInput
                            type="date"
                            label="Birth Date"
                            required
                            value={formData.birthDate}
                            onChange={(value) => updateField('birthDate', value)}
                            helpText="Must be 18 or older"
                        />
                        <ValidatedInput
                            {...VALIDATED_INPUT_PRESETS.phone}
                            label="Phone Number"
                            value={formData.phone}
                            onChange={(value) => updateField('phone', value)}
                            asyncValidator={COMMON_VALIDATORS.phone}
                            helpText="Optional - for account recovery"
                        />
                    </div>
                    <ValidatedInput
                        {...VALIDATED_INPUT_PRESETS.url}
                        label="Website"
                        value={formData.website}
                        onChange={(value) => updateField('website', value)}
                        asyncValidator={COMMON_VALIDATORS.url}
                        helpText="Optional - your personal or business website"
                    />
                </ValidatedForm>
            </CardContent>
        </Card>
    );
};

/**
 * Date Range Form Example
 */
export const DateRangeExample = () => {
    const [formData, setFormData] = useState<DateRangeForm>({
        startDate: '',
        endDate: '',
        eventName: ''
    });

    const validationRules = [
        COMMON_CROSS_FIELD_RULES.dateRange('startDate', 'endDate'),
        COMMON_CROSS_FIELD_RULES.minDateRangeDuration(
            'startDate',
            'endDate',
            1,
            'days',
            'Event must be at least 1 day long'
        )
    ];

    const handleSubmit = async (data: DateRangeForm) => {
        adminLogger.info('Event created:', JSON.stringify(data, null, 2));
        await new Promise((resolve) => setTimeout(resolve, 1000));
    };

    const updateField = <K extends keyof DateRangeForm>(field: K, value: DateRangeForm[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Event Date Range Form</CardTitle>
                <p className="text-muted-foreground text-sm">
                    Demonstrates date range validation and minimum duration rules
                </p>
            </CardHeader>
            <CardContent>
                <ValidatedForm
                    formData={formData}
                    validationRules={validationRules}
                    onSubmit={handleSubmit}
                    submitText="Create Event"
                    successMessage="Event created successfully!"
                >
                    <ValidatedInput
                        type="text"
                        label="Event Name"
                        required
                        value={formData.eventName}
                        onChange={(value) => updateField('eventName', value)}
                        placeholder="Enter event name"
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ValidatedInput
                            type="date"
                            label="Start Date"
                            required
                            value={formData.startDate}
                            onChange={(value) => updateField('startDate', value)}
                        />
                        <ValidatedInput
                            type="date"
                            label="End Date"
                            required
                            value={formData.endDate}
                            onChange={(value) => updateField('endDate', value)}
                        />
                    </div>
                </ValidatedForm>
            </CardContent>
        </Card>
    );
};

/**
 * Conditional Fields Form Example
 */
export const ConditionalFieldsExample = () => {
    const [formData, setFormData] = useState<ConditionalForm>({
        paymentMethod: '',
        cardNumber: '',
        billingAddress: '',
        amount: ''
    });

    const validationRules = [
        COMMON_CROSS_FIELD_RULES.conditionalRequired(
            'cardNumber',
            'paymentMethod',
            (value) => value === 'credit_card',
            'Card number is required for credit card payments'
        ),
        COMMON_CROSS_FIELD_RULES.conditionalRequired(
            'billingAddress',
            'paymentMethod',
            (value) => value === 'credit_card',
            'Billing address is required for credit card payments'
        ),
        COMMON_CROSS_FIELD_RULES.numericRange('amount', 'amount')
    ];

    const handleSubmit = async (data: ConditionalForm) => {
        adminLogger.info('Payment processed:', JSON.stringify(data, null, 2));
        await new Promise((resolve) => setTimeout(resolve, 1500));
    };

    const updateField = <K extends keyof ConditionalForm>(field: K, value: ConditionalForm[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Conditional Payment Form</CardTitle>
                <p className="text-muted-foreground text-sm">
                    Demonstrates conditional field validation based on other field values
                </p>
            </CardHeader>
            <CardContent>
                <ValidatedForm
                    formData={formData}
                    validationRules={validationRules}
                    onSubmit={handleSubmit}
                    submitText="Process Payment"
                    successMessage="Payment processed successfully!"
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label
                                htmlFor="payment-method"
                                className="mb-1 block font-medium text-foreground text-sm"
                            >
                                Payment Method *
                            </label>
                            <select
                                id="payment-method"
                                value={formData.paymentMethod}
                                onChange={(e) =>
                                    updateField(
                                        'paymentMethod',
                                        e.target.value as ConditionalForm['paymentMethod']
                                    )
                                }
                                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            >
                                <option value="">Select payment method</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="paypal">PayPal</option>
                                <option value="bank_transfer">Bank Transfer</option>
                            </select>
                        </div>
                        <ValidatedInput
                            type="number"
                            label="Amount"
                            required
                            value={formData.amount}
                            onChange={(value) => updateField('amount', value)}
                            placeholder="0.00"
                            min="0.01"
                            step="0.01"
                        />
                    </div>
                    {formData.paymentMethod === 'credit_card' && (
                        <div className="space-y-4 border-t pt-4">
                            <h3 className="font-medium text-foreground text-lg">
                                Credit Card Details
                            </h3>
                            <ValidatedInput
                                type="text"
                                label="Card Number"
                                required
                                value={formData.cardNumber}
                                onChange={(value) => updateField('cardNumber', value)}
                                asyncValidator={COMMON_VALIDATORS.creditCard}
                                placeholder="1234 5678 9012 3456"
                                helpText="Enter your 16-digit card number"
                            />
                            <ValidatedInput
                                type="text"
                                label="Billing Address"
                                required
                                value={formData.billingAddress}
                                onChange={(value) => updateField('billingAddress', value)}
                                placeholder="123 Main St, City, State 12345"
                                helpText="Address associated with your card"
                            />
                        </div>
                    )}
                </ValidatedForm>
            </CardContent>
        </Card>
    );
};
