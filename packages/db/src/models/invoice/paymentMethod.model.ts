import type { PaymentMethod } from '@repo/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { paymentMethods } from '../../schemas/payment/paymentMethod.dbschema';

/**
 * Create Payment Method type from database schema
 */
export type CreatePaymentMethod = typeof paymentMethods.$inferInsert;

/**
 * Payment Method business logic and database operations
 */
export class PaymentMethodModel extends BaseModel<PaymentMethod> {
    protected table = paymentMethods;
    protected entityName = 'payment_method' as const;

    protected getTableName(): string {
        return 'payment_methods';
    }

    /**
     * Validate card data before storing
     */
    async validateCard(cardData: {
        number: string;
        expiryMonth: number;
        expiryYear: number;
        cvv: string;
    }): Promise<{ valid: boolean; reason?: string }> {
        // Basic card number validation (Luhn algorithm)
        if (!this.isValidCardNumber(cardData.number)) {
            return { valid: false, reason: 'INVALID_CARD_NUMBER' };
        }

        // Expiry date validation
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        if (
            cardData.expiryYear < currentYear ||
            (cardData.expiryYear === currentYear && cardData.expiryMonth < currentMonth)
        ) {
            return { valid: false, reason: 'CARD_EXPIRED' };
        }

        // CVV validation
        if (!/^\d{3,4}$/.test(cardData.cvv)) {
            return { valid: false, reason: 'INVALID_CVV' };
        }

        return { valid: true };
    }

    /**
     * Tokenize card data (mock implementation - use real payment provider)
     */
    async tokenize(cardData: {
        number: string;
        expiryMonth: number;
        expiryYear: number;
        cvv: string;
        holderName: string;
    }): Promise<{
        success: boolean;
        token?: string;
        brand?: string;
        last4?: string;
        error?: string;
    }> {
        try {
            // Validate card first
            const validation = await this.validateCard(cardData);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.reason || 'Invalid card data'
                };
            }

            // Mock tokenization (in real app, use Stripe, PayPal, etc.)
            const token = `tok_${Math.random().toString(36).substring(2, 15)}`;
            const brand = this.detectCardBrand(cardData.number);
            const last4 = cardData.number.slice(-4);

            return {
                success: true,
                token,
                brand,
                last4
            };
        } catch (error) {
            return {
                success: false,
                error: `Tokenization failed: ${error}`
            };
        }
    }

    /**
     * Check if payment method is expired
     */
    async checkExpiration(
        paymentMethodId: string
    ): Promise<{ expired: boolean; expiryMonth?: number; expiryYear?: number }> {
        const db = getDb();

        try {
            const paymentMethod = await db.query.paymentMethods.findFirst({
                where: and(eq(paymentMethods.id, paymentMethodId), isNull(paymentMethods.deletedAt))
            });

            if (!paymentMethod || !paymentMethod.cardExpiryMonth || !paymentMethod.cardExpiryYear) {
                return { expired: false };
            }

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            const expired =
                paymentMethod.cardExpiryYear < currentYear ||
                (paymentMethod.cardExpiryYear === currentYear &&
                    paymentMethod.cardExpiryMonth < currentMonth);

            return {
                expired,
                expiryMonth: paymentMethod.cardExpiryMonth,
                expiryYear: paymentMethod.cardExpiryYear
            };
        } catch {
            return { expired: false };
        }
    }

    /**
     * Set payment method as default for client
     */
    async setAsDefault(paymentMethodId: string): Promise<{ success: boolean; error?: string }> {
        const db = getDb();

        try {
            // Get payment method to find client
            const paymentMethod = await db.query.paymentMethods.findFirst({
                where: and(eq(paymentMethods.id, paymentMethodId), isNull(paymentMethods.deletedAt))
            });

            if (!paymentMethod) {
                return { success: false, error: 'Payment method not found' };
            }

            // Transaction to update defaults
            await db.transaction(async (tx) => {
                // First, unset all default methods for this client
                await tx
                    .update(paymentMethods)
                    .set({
                        isDefault: false,
                        updatedAt: new Date()
                    })
                    .where(
                        and(
                            eq(paymentMethods.clientId, paymentMethod.clientId),
                            isNull(paymentMethods.deletedAt)
                        )
                    );

                // Then set this one as default
                await tx
                    .update(paymentMethods)
                    .set({
                        isDefault: true,
                        updatedAt: new Date()
                    })
                    .where(eq(paymentMethods.id, paymentMethodId));
            });

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Failed to set as default: ${error}`
            };
        }
    }

    /**
     * Find payment methods by client
     */
    async findByClient(clientId: string): Promise<PaymentMethod[]> {
        const db = getDb();

        return db.query.paymentMethods.findMany({
            where: and(eq(paymentMethods.clientId, clientId), isNull(paymentMethods.deletedAt)),
            orderBy: (table, { desc }) => [desc(table.isDefault), desc(table.createdAt)]
        });
    }

    /**
     * Get default payment method for client
     */
    async getDefaultForClient(clientId: string): Promise<PaymentMethod | null> {
        const db = getDb();

        const defaultMethod = await db.query.paymentMethods.findFirst({
            where: and(
                eq(paymentMethods.clientId, clientId),
                eq(paymentMethods.isDefault, true),
                isNull(paymentMethods.deletedAt)
            )
        });

        return defaultMethod || null;
    }

    /**
     * Find expired payment methods
     */
    async findExpired(): Promise<PaymentMethod[]> {
        const db = getDb();

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Get all active payment methods with expiry dates
        const allMethods = await db.query.paymentMethods.findMany({
            where: isNull(paymentMethods.deletedAt)
        });

        // Filter expired ones (needs to be done in memory for now)
        return allMethods.filter((method) => {
            if (!method.cardExpiryMonth || !method.cardExpiryYear) return false;
            return (
                method.cardExpiryYear < currentYear ||
                (method.cardExpiryYear === currentYear && method.cardExpiryMonth < currentMonth)
            );
        }) as PaymentMethod[];
    }

    /**
     * Create payment method with card tokenization
     */
    async createWithCard(data: {
        clientId: string;
        type: string;
        cardNumber: string;
        expiryMonth: number;
        expiryYear: number;
        cvv: string;
        holderName: string;
        displayName?: string;
        setAsDefault?: boolean;
    }): Promise<{ success: boolean; paymentMethod?: PaymentMethod; error?: string }> {
        try {
            // Tokenize card
            const tokenResult = await this.tokenize({
                number: data.cardNumber,
                expiryMonth: data.expiryMonth,
                expiryYear: data.expiryYear,
                cvv: data.cvv,
                holderName: data.holderName
            });

            if (!tokenResult.success) {
                return {
                    success: false,
                    error: tokenResult.error || 'Card tokenization failed'
                };
            }

            // Create payment method
            const paymentMethodData: CreatePaymentMethod = {
                clientId: data.clientId,
                type: data.type,
                displayName:
                    data.displayName || `${tokenResult.brand || 'Card'} ****${tokenResult.last4}`,
                isDefault: data.setAsDefault || false,
                isActive: true,
                cardBrand: tokenResult.brand,
                cardLast4: tokenResult.last4,
                cardExpiryMonth: data.expiryMonth,
                cardExpiryYear: data.expiryYear,
                providerPaymentMethodId: tokenResult.token
            };

            const paymentMethod = await this.create(paymentMethodData);

            // If setting as default, ensure others are not default
            if (data.setAsDefault) {
                await this.setAsDefault(paymentMethod.id);
            }

            return {
                success: true,
                paymentMethod
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to create payment method: ${error}`
            };
        }
    }

    /**
     * Remove payment method (soft delete)
     */
    async remove(paymentMethodId: string): Promise<{ success: boolean; error?: string }> {
        const db = getDb();

        try {
            // Check if it's the default method
            const paymentMethod = await db.query.paymentMethods.findFirst({
                where: and(eq(paymentMethods.id, paymentMethodId), isNull(paymentMethods.deletedAt))
            });

            if (!paymentMethod) {
                return { success: false, error: 'Payment method not found' };
            }

            // Soft delete
            await this.softDelete({ id: paymentMethodId });

            // If it was default, set another one as default
            if (paymentMethod.isDefault) {
                const otherMethods = await this.findByClient(paymentMethod.clientId);
                if (otherMethods.length > 0 && otherMethods[0]) {
                    await this.setAsDefault(otherMethods[0].id);
                }
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Failed to remove payment method: ${error}`
            };
        }
    }

    /**
     * Update payment method expiry
     */
    async updateExpiry(
        paymentMethodId: string,
        expiryMonth: number,
        expiryYear: number
    ): Promise<PaymentMethod | null> {
        const db = getDb();

        try {
            const [updated] = await db
                .update(paymentMethods)
                .set({
                    cardExpiryMonth: expiryMonth,
                    cardExpiryYear: expiryYear,
                    updatedAt: new Date()
                })
                .where(
                    and(eq(paymentMethods.id, paymentMethodId), isNull(paymentMethods.deletedAt))
                )
                .returning();

            return updated || null;
        } catch (error) {
            throw new Error(`Failed to update expiry: ${error}`);
        }
    }

    /**
     * Validate card number using Luhn algorithm
     */
    private isValidCardNumber(cardNumber: string): boolean {
        // Remove spaces and non-digits
        const number = cardNumber.replace(/\D/g, '');

        // Must be 13-19 digits
        if (number.length < 13 || number.length > 19) {
            return false;
        }

        // Luhn algorithm
        let sum = 0;
        let isEven = false;

        for (let i = number.length - 1; i >= 0; i--) {
            const char = number[i];
            if (!char) continue;

            let digit = Number.parseInt(char, 10);

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    /**
     * Detect card brand from number
     */
    private detectCardBrand(cardNumber: string): string {
        const number = cardNumber.replace(/\D/g, '');

        // Visa
        if (/^4/.test(number)) {
            return 'visa';
        }

        // MasterCard
        if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) {
            return 'mastercard';
        }

        // American Express
        if (/^3[47]/.test(number)) {
            return 'amex';
        }

        // Discover
        if (/^6(?:011|5)/.test(number)) {
            return 'discover';
        }

        return 'unknown';
    }
}

export { paymentMethods } from '../../schemas/payment/paymentMethod.dbschema';
