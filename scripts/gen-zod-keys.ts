/**
 * Generator script: merges missing zod validation translation keys into the
 * three locale validation.json files (es / en / pt).
 *
 * Run once:
 *   pnpm tsx scripts/gen-zod-keys.ts
 *
 * The primary deliverable is the updated validation.json files.
 * This script is idempotent: running it again on already-patched files is a no-op.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

// ---------------------------------------------------------------------------
// Missing keys (128 total — exact list from --verify output)
// ---------------------------------------------------------------------------

/**
 * Each entry maps a dot-separated path (relative to validation.json root,
 * WITHOUT the "zodError." prefix) to messages in es / en / pt.
 */
const MISSING_KEYS: Array<{ path: string; es: string; en: string; pt: string }> = [
    // -----------------------------------------------------------------------
    // admin.search.entityComment
    // -----------------------------------------------------------------------
    {
        path: 'admin.search.entityComment.authorId.uuid',
        es: 'El ID del autor debe ser un UUID válido',
        en: 'Author ID must be a valid UUID',
        pt: 'O ID do autor deve ser um UUID válido'
    },
    {
        path: 'admin.search.entityComment.entityId.uuid',
        es: 'El ID de la entidad debe ser un UUID válido',
        en: 'Entity ID must be a valid UUID',
        pt: 'O ID da entidade deve ser um UUID válido'
    },

    // -----------------------------------------------------------------------
    // billing.plan.category
    // -----------------------------------------------------------------------
    {
        path: 'billing.plan.category.invalid',
        es: 'La categoría del plan no es válida',
        en: 'Plan category is not valid',
        pt: 'A categoria do plano não é válida'
    },

    // -----------------------------------------------------------------------
    // billing.plan.create.*
    // -----------------------------------------------------------------------
    {
        path: 'billing.plan.create.annualPriceArs.int',
        es: 'El precio anual en ARS debe ser un número entero',
        en: 'Annual price in ARS must be an integer',
        pt: 'O preço anual em ARS deve ser um número inteiro'
    },
    {
        path: 'billing.plan.create.annualPriceArs.invalidType',
        es: 'El precio anual en ARS tiene un tipo de dato inválido',
        en: 'Annual price in ARS has an invalid data type',
        pt: 'O preço anual em ARS tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.annualPriceArs.min',
        es: 'El precio anual en ARS debe ser al menos {{min}}',
        en: 'Annual price in ARS must be at least {{min}}',
        pt: 'O preço anual em ARS deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.create.description.invalidType',
        es: 'La descripción tiene un tipo de dato inválido',
        en: 'Description has an invalid data type',
        pt: 'A descrição tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.description.max',
        es: 'La descripción no puede superar los {{max}} caracteres',
        en: 'Description cannot exceed {{max}} characters',
        pt: 'A descrição não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.plan.create.hasTrial.invalidType',
        es: 'El campo de prueba tiene un tipo de dato inválido',
        en: 'Trial flag has an invalid data type',
        pt: 'O campo de período de teste tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.isActive.invalidType',
        es: 'El campo activo tiene un tipo de dato inválido',
        en: 'Active flag has an invalid data type',
        pt: 'O campo ativo tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.isDefault.invalidType',
        es: 'El campo predeterminado tiene un tipo de dato inválido',
        en: 'Default flag has an invalid data type',
        pt: 'O campo padrão tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.monthlyPriceArs.int',
        es: 'El precio mensual en ARS debe ser un número entero',
        en: 'Monthly price in ARS must be an integer',
        pt: 'O preço mensal em ARS deve ser um número inteiro'
    },
    {
        path: 'billing.plan.create.monthlyPriceArs.invalidType',
        es: 'El precio mensual en ARS tiene un tipo de dato inválido',
        en: 'Monthly price in ARS has an invalid data type',
        pt: 'O preço mensal em ARS tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.monthlyPriceArs.min',
        es: 'El precio mensual en ARS debe ser al menos {{min}}',
        en: 'Monthly price in ARS must be at least {{min}}',
        pt: 'O preço mensal em ARS deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.create.monthlyPriceUsdRef.invalidType',
        es: 'El precio mensual de referencia en USD tiene un tipo de dato inválido',
        en: 'Monthly USD reference price has an invalid data type',
        pt: 'O preço mensal de referência em USD tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.monthlyPriceUsdRef.min',
        es: 'El precio mensual de referencia en USD debe ser al menos {{min}}',
        en: 'Monthly USD reference price must be at least {{min}}',
        pt: 'O preço mensal de referência em USD deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.create.name.invalidType',
        es: 'El nombre del plan tiene un tipo de dato inválido',
        en: 'Plan name has an invalid data type',
        pt: 'O nome do plano tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.name.max',
        es: 'El nombre del plan no puede superar los {{max}} caracteres',
        en: 'Plan name cannot exceed {{max}} characters',
        pt: 'O nome do plano não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.plan.create.name.min',
        es: 'El nombre del plan debe tener al menos {{min}} caracteres',
        en: 'Plan name must be at least {{min}} characters',
        pt: 'O nome do plano deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'billing.plan.create.slug.format',
        es: 'El formato del slug no es válido (solo letras minúsculas, números y guiones)',
        en: 'Slug format is not valid (lowercase letters, numbers and hyphens only)',
        pt: 'O formato do slug não é válido (apenas letras minúsculas, números e hífens)'
    },
    {
        path: 'billing.plan.create.slug.invalidType',
        es: 'El slug tiene un tipo de dato inválido',
        en: 'Slug has an invalid data type',
        pt: 'O slug tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.slug.max',
        es: 'El slug no puede superar los {{max}} caracteres',
        en: 'Slug cannot exceed {{max}} characters',
        pt: 'O slug não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.plan.create.slug.min',
        es: 'El slug debe tener al menos {{min}} caracteres',
        en: 'Slug must be at least {{min}} characters',
        pt: 'O slug deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'billing.plan.create.sortOrder.int',
        es: 'El orden de visualización debe ser un número entero',
        en: 'Sort order must be an integer',
        pt: 'A ordem de exibição deve ser um número inteiro'
    },
    {
        path: 'billing.plan.create.sortOrder.invalidType',
        es: 'El orden de visualización tiene un tipo de dato inválido',
        en: 'Sort order has an invalid data type',
        pt: 'A ordem de exibição tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.sortOrder.min',
        es: 'El orden de visualización debe ser al menos {{min}}',
        en: 'Sort order must be at least {{min}}',
        pt: 'A ordem de exibição deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.create.trialDays.int',
        es: 'Los días de prueba deben ser un número entero',
        en: 'Trial days must be an integer',
        pt: 'Os dias de teste devem ser um número inteiro'
    },
    {
        path: 'billing.plan.create.trialDays.invalidType',
        es: 'Los días de prueba tienen un tipo de dato inválido',
        en: 'Trial days have an invalid data type',
        pt: 'Os dias de teste têm um tipo de dado inválido'
    },
    {
        path: 'billing.plan.create.trialDays.min',
        es: 'Los días de prueba deben ser al menos {{min}}',
        en: 'Trial days must be at least {{min}}',
        pt: 'Os dias de teste devem ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.create.trialDays.requiredWhenTrial',
        es: 'Los días de prueba son obligatorios cuando el plan tiene período de prueba',
        en: 'Trial days are required when the plan has a trial period',
        pt: 'Os dias de teste são obrigatórios quando o plano tem período de teste'
    },

    // -----------------------------------------------------------------------
    // billing.plan.entitlements
    // -----------------------------------------------------------------------
    {
        path: 'billing.plan.entitlements.invalidType',
        es: 'Los derechos del plan tienen un tipo de dato inválido',
        en: 'Plan entitlements have an invalid data type',
        pt: 'Os direitos do plano têm um tipo de dado inválido'
    },
    {
        path: 'billing.plan.entitlements.item.invalidType',
        es: 'El derecho del plan tiene un tipo de dato inválido',
        en: 'Plan entitlement item has an invalid data type',
        pt: 'O direito do plano tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.entitlements.item.min',
        es: 'El derecho del plan debe tener al menos {{min}} caracteres',
        en: 'Plan entitlement item must be at least {{min}} characters',
        pt: 'O direito do plano deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'billing.plan.entitlements.max',
        es: 'Los derechos del plan no pueden superar los {{max}} elementos',
        en: 'Plan entitlements cannot exceed {{max}} items',
        pt: 'Os direitos do plano não podem ultrapassar {{max}} itens'
    },

    // -----------------------------------------------------------------------
    // billing.plan.limits
    // -----------------------------------------------------------------------
    {
        path: 'billing.plan.limits.key.invalidType',
        es: 'La clave del límite tiene un tipo de dato inválido',
        en: 'Limit key has an invalid data type',
        pt: 'A chave do limite tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.limits.key.min',
        es: 'La clave del límite debe tener al menos {{min}} caracteres',
        en: 'Limit key must be at least {{min}} characters',
        pt: 'A chave do limite deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'billing.plan.limits.value.int',
        es: 'El valor del límite debe ser un número entero',
        en: 'Limit value must be an integer',
        pt: 'O valor do limite deve ser um número inteiro'
    },
    {
        path: 'billing.plan.limits.value.invalidType',
        es: 'El valor del límite tiene un tipo de dato inválido',
        en: 'Limit value has an invalid data type',
        pt: 'O valor do limite tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.limits.value.min',
        es: 'El valor del límite debe ser al menos {{min}}',
        en: 'Limit value must be at least {{min}}',
        pt: 'O valor do limite deve ser pelo menos {{min}}'
    },

    // -----------------------------------------------------------------------
    // billing.plan.update.*
    // -----------------------------------------------------------------------
    {
        path: 'billing.plan.update.annualPriceArs.int',
        es: 'El precio anual en ARS debe ser un número entero',
        en: 'Annual price in ARS must be an integer',
        pt: 'O preço anual em ARS deve ser um número inteiro'
    },
    {
        path: 'billing.plan.update.annualPriceArs.invalidType',
        es: 'El precio anual en ARS tiene un tipo de dato inválido',
        en: 'Annual price in ARS has an invalid data type',
        pt: 'O preço anual em ARS tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.annualPriceArs.min',
        es: 'El precio anual en ARS debe ser al menos {{min}}',
        en: 'Annual price in ARS must be at least {{min}}',
        pt: 'O preço anual em ARS deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.update.description.invalidType',
        es: 'La descripción tiene un tipo de dato inválido',
        en: 'Description has an invalid data type',
        pt: 'A descrição tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.description.max',
        es: 'La descripción no puede superar los {{max}} caracteres',
        en: 'Description cannot exceed {{max}} characters',
        pt: 'A descrição não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.plan.update.hasTrial.invalidType',
        es: 'El campo de prueba tiene un tipo de dato inválido',
        en: 'Trial flag has an invalid data type',
        pt: 'O campo de período de teste tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.isActive.invalidType',
        es: 'El campo activo tiene un tipo de dato inválido',
        en: 'Active flag has an invalid data type',
        pt: 'O campo ativo tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.isDefault.invalidType',
        es: 'El campo predeterminado tiene un tipo de dato inválido',
        en: 'Default flag has an invalid data type',
        pt: 'O campo padrão tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.monthlyPriceArs.int',
        es: 'El precio mensual en ARS debe ser un número entero',
        en: 'Monthly price in ARS must be an integer',
        pt: 'O preço mensal em ARS deve ser um número inteiro'
    },
    {
        path: 'billing.plan.update.monthlyPriceArs.invalidType',
        es: 'El precio mensual en ARS tiene un tipo de dato inválido',
        en: 'Monthly price in ARS has an invalid data type',
        pt: 'O preço mensal em ARS tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.monthlyPriceArs.min',
        es: 'El precio mensual en ARS debe ser al menos {{min}}',
        en: 'Monthly price in ARS must be at least {{min}}',
        pt: 'O preço mensal em ARS deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.update.monthlyPriceUsdRef.invalidType',
        es: 'El precio mensual de referencia en USD tiene un tipo de dato inválido',
        en: 'Monthly USD reference price has an invalid data type',
        pt: 'O preço mensal de referência em USD tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.monthlyPriceUsdRef.min',
        es: 'El precio mensual de referencia en USD debe ser al menos {{min}}',
        en: 'Monthly USD reference price must be at least {{min}}',
        pt: 'O preço mensal de referência em USD deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.update.name.invalidType',
        es: 'El nombre del plan tiene un tipo de dato inválido',
        en: 'Plan name has an invalid data type',
        pt: 'O nome do plano tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.name.max',
        es: 'El nombre del plan no puede superar los {{max}} caracteres',
        en: 'Plan name cannot exceed {{max}} characters',
        pt: 'O nome do plano não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.plan.update.name.min',
        es: 'El nombre del plan debe tener al menos {{min}} caracteres',
        en: 'Plan name must be at least {{min}} characters',
        pt: 'O nome do plano deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'billing.plan.update.sortOrder.int',
        es: 'El orden de visualización debe ser un número entero',
        en: 'Sort order must be an integer',
        pt: 'A ordem de exibição deve ser um número inteiro'
    },
    {
        path: 'billing.plan.update.sortOrder.invalidType',
        es: 'El orden de visualización tiene un tipo de dato inválido',
        en: 'Sort order has an invalid data type',
        pt: 'A ordem de exibição tem um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.sortOrder.min',
        es: 'El orden de visualización debe ser al menos {{min}}',
        en: 'Sort order must be at least {{min}}',
        pt: 'A ordem de exibição deve ser pelo menos {{min}}'
    },
    {
        path: 'billing.plan.update.trialDays.int',
        es: 'Los días de prueba deben ser un número entero',
        en: 'Trial days must be an integer',
        pt: 'Os dias de teste devem ser um número inteiro'
    },
    {
        path: 'billing.plan.update.trialDays.invalidType',
        es: 'Los días de prueba tienen un tipo de dato inválido',
        en: 'Trial days have an invalid data type',
        pt: 'Os dias de teste têm um tipo de dado inválido'
    },
    {
        path: 'billing.plan.update.trialDays.min',
        es: 'Los días de prueba deben ser al menos {{min}}',
        en: 'Trial days must be at least {{min}}',
        pt: 'Os dias de teste devem ser pelo menos {{min}}'
    },

    // -----------------------------------------------------------------------
    // billing.planChange
    // -----------------------------------------------------------------------
    {
        path: 'billing.planChange.checkoutUrl.invalid',
        es: 'La URL de pago no es válida',
        en: 'Checkout URL is not valid',
        pt: 'A URL de pagamento não é válida'
    },

    // -----------------------------------------------------------------------
    // billing.promoCode.apply
    // -----------------------------------------------------------------------
    {
        path: 'billing.promoCode.apply.customerId.invalid',
        es: 'El ID del cliente no es válido',
        en: 'Customer ID is not valid',
        pt: 'O ID do cliente não é válido'
    },

    // -----------------------------------------------------------------------
    // billing.promoCode.create
    // -----------------------------------------------------------------------
    {
        path: 'billing.promoCode.create.code.format',
        es: 'El formato del código promocional no es válido (solo letras mayúsculas, números y guiones)',
        en: 'Promo code format is not valid (uppercase letters, numbers and hyphens only)',
        pt: 'O formato do código promocional não é válido (apenas letras maiúsculas, números e hífens)'
    },
    {
        path: 'billing.promoCode.create.description.invalidType',
        es: 'La descripción tiene un tipo de dato inválido',
        en: 'Description has an invalid data type',
        pt: 'A descrição tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.create.description.max',
        es: 'La descripción no puede superar los {{max}} caracteres',
        en: 'Description cannot exceed {{max}} characters',
        pt: 'A descrição não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.promoCode.create.discountValue.percentageMax',
        es: 'El descuento porcentual no puede superar el 100%',
        en: 'Percentage discount cannot exceed 100%',
        pt: 'O desconto percentual não pode ultrapassar 100%'
    },
    {
        path: 'billing.promoCode.create.isActive.invalidType',
        es: 'El campo activo tiene un tipo de dato inválido',
        en: 'Active flag has an invalid data type',
        pt: 'O campo ativo tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.create.isStackable.invalidType',
        es: 'El campo apilable tiene un tipo de dato inválido',
        en: 'Stackable flag has an invalid data type',
        pt: 'O campo empilhável tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.create.maxUsesPerUser.int',
        es: 'El máximo de usos por usuario debe ser un número entero',
        en: 'Max uses per user must be an integer',
        pt: 'O máximo de usos por usuário deve ser um número inteiro'
    },
    {
        path: 'billing.promoCode.create.maxUsesPerUser.invalidType',
        es: 'El máximo de usos por usuario tiene un tipo de dato inválido',
        en: 'Max uses per user has an invalid data type',
        pt: 'O máximo de usos por usuário tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.create.maxUsesPerUser.positive',
        es: 'El máximo de usos por usuario debe ser un número positivo',
        en: 'Max uses per user must be a positive number',
        pt: 'O máximo de usos por usuário deve ser um número positivo'
    },
    {
        path: 'billing.promoCode.create.minAmount.int',
        es: 'El monto mínimo debe ser un número entero',
        en: 'Minimum amount must be an integer',
        pt: 'O valor mínimo deve ser um número inteiro'
    },
    {
        path: 'billing.promoCode.create.minAmount.invalidType',
        es: 'El monto mínimo tiene un tipo de dato inválido',
        en: 'Minimum amount has an invalid data type',
        pt: 'O valor mínimo tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.create.minAmount.positive',
        es: 'El monto mínimo debe ser un número positivo',
        en: 'Minimum amount must be a positive number',
        pt: 'O valor mínimo deve ser um número positivo'
    },
    {
        path: 'billing.promoCode.create.validFrom.invalid',
        es: 'La fecha de inicio de validez no es válida',
        en: 'Valid-from date is not valid',
        pt: 'A data de início de validade não é válida'
    },

    // -----------------------------------------------------------------------
    // billing.promoCode.update
    // -----------------------------------------------------------------------
    {
        path: 'billing.promoCode.update.description.invalidType',
        es: 'La descripción tiene un tipo de dato inválido',
        en: 'Description has an invalid data type',
        pt: 'A descrição tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.update.description.max',
        es: 'La descripción no puede superar los {{max}} caracteres',
        en: 'Description cannot exceed {{max}} characters',
        pt: 'A descrição não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.promoCode.update.expiryDate.invalid',
        es: 'La fecha de vencimiento no es válida',
        en: 'Expiry date is not valid',
        pt: 'A data de vencimento não é válida'
    },
    {
        path: 'billing.promoCode.update.isActive.invalidType',
        es: 'El campo activo tiene un tipo de dato inválido',
        en: 'Active flag has an invalid data type',
        pt: 'O campo ativo tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.update.maxUses.int',
        es: 'El máximo de usos debe ser un número entero',
        en: 'Max uses must be an integer',
        pt: 'O máximo de usos deve ser um número inteiro'
    },
    {
        path: 'billing.promoCode.update.maxUses.invalidType',
        es: 'El máximo de usos tiene un tipo de dato inválido',
        en: 'Max uses has an invalid data type',
        pt: 'O máximo de usos tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.update.maxUses.positive',
        es: 'El máximo de usos debe ser un número positivo',
        en: 'Max uses must be a positive number',
        pt: 'O máximo de usos deve ser um número positivo'
    },

    // -----------------------------------------------------------------------
    // billing.promoCode.validate
    // -----------------------------------------------------------------------
    {
        path: 'billing.promoCode.validate.amount.int',
        es: 'El monto debe ser un número entero',
        en: 'Amount must be an integer',
        pt: 'O valor deve ser um número inteiro'
    },
    {
        path: 'billing.promoCode.validate.amount.invalidType',
        es: 'El monto tiene un tipo de dato inválido',
        en: 'Amount has an invalid data type',
        pt: 'O valor tem um tipo de dado inválido'
    },
    {
        path: 'billing.promoCode.validate.amount.positive',
        es: 'El monto debe ser un número positivo',
        en: 'Amount must be a positive number',
        pt: 'O valor deve ser um número positivo'
    },
    {
        path: 'billing.promoCode.validate.planId.invalid',
        es: 'El ID del plan no es válido',
        en: 'Plan ID is not valid',
        pt: 'O ID do plano não é válido'
    },
    {
        path: 'billing.promoCode.validate.userId.invalid',
        es: 'El ID del usuario no es válido',
        en: 'User ID is not valid',
        pt: 'O ID do usuário não é válido'
    },

    // -----------------------------------------------------------------------
    // billing.startPaid
    // -----------------------------------------------------------------------
    {
        path: 'billing.startPaid.billingInterval.invalid',
        es: 'El intervalo de facturación no es válido',
        en: 'Billing interval is not valid',
        pt: 'O intervalo de faturamento não é válido'
    },
    {
        path: 'billing.startPaid.checkoutUrl.invalid',
        es: 'La URL de pago no es válida',
        en: 'Checkout URL is not valid',
        pt: 'A URL de pagamento não é válida'
    },
    {
        path: 'billing.startPaid.checkoutUrl.invalidType',
        es: 'La URL de pago tiene un tipo de dato inválido',
        en: 'Checkout URL has an invalid data type',
        pt: 'A URL de pagamento tem um tipo de dado inválido'
    },
    {
        path: 'billing.startPaid.expiresAt.invalid',
        es: 'La fecha de expiración no es válida',
        en: 'Expiry date is not valid',
        pt: 'A data de expiração não é válida'
    },
    {
        path: 'billing.startPaid.expiresAt.invalidType',
        es: 'La fecha de expiración tiene un tipo de dato inválido',
        en: 'Expiry date has an invalid data type',
        pt: 'A data de expiração tem um tipo de dado inválido'
    },
    {
        path: 'billing.startPaid.localSubscriptionId.invalid',
        es: 'El ID de suscripción local no es válido',
        en: 'Local subscription ID is not valid',
        pt: 'O ID de assinatura local não é válido'
    },
    {
        path: 'billing.startPaid.localSubscriptionId.invalidType',
        es: 'El ID de suscripción local tiene un tipo de dato inválido',
        en: 'Local subscription ID has an invalid data type',
        pt: 'O ID de assinatura local tem um tipo de dado inválido'
    },
    {
        path: 'billing.startPaid.planSlug.invalidType',
        es: 'El slug del plan tiene un tipo de dato inválido',
        en: 'Plan slug has an invalid data type',
        pt: 'O slug do plano tem um tipo de dado inválido'
    },
    {
        path: 'billing.startPaid.planSlug.max',
        es: 'El slug del plan no puede superar los {{max}} caracteres',
        en: 'Plan slug cannot exceed {{max}} characters',
        pt: 'O slug do plano não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.startPaid.planSlug.min',
        es: 'El slug del plan debe tener al menos {{min}} caracteres',
        en: 'Plan slug must be at least {{min}} characters',
        pt: 'O slug do plano deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'billing.startPaid.promoCode.invalidType',
        es: 'El código promocional tiene un tipo de dato inválido',
        en: 'Promo code has an invalid data type',
        pt: 'O código promocional tem um tipo de dado inválido'
    },
    {
        path: 'billing.startPaid.promoCode.max',
        es: 'El código promocional no puede superar los {{max}} caracteres',
        en: 'Promo code cannot exceed {{max}} characters',
        pt: 'O código promocional não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'billing.startPaid.promoCode.min',
        es: 'El código promocional debe tener al menos {{min}} caracteres',
        en: 'Promo code must be at least {{min}} characters',
        pt: 'O código promocional deve ter pelo menos {{min}} caracteres'
    },

    // -----------------------------------------------------------------------
    // common.options
    // -----------------------------------------------------------------------
    {
        path: 'common.options.limit.max',
        es: 'El límite no puede superar los {{max}} elementos',
        en: 'Limit cannot exceed {{max}} items',
        pt: 'O limite não pode ultrapassar {{max}} itens'
    },
    {
        path: 'common.options.limit.min',
        es: 'El límite debe ser al menos {{min}}',
        en: 'Limit must be at least {{min}}',
        pt: 'O limite deve ser pelo menos {{min}}'
    },

    // -----------------------------------------------------------------------
    // entity.newsletterSubscriber.preferences
    // -----------------------------------------------------------------------
    {
        path: 'entity.newsletterSubscriber.preferences.atLeastOne',
        es: 'Debe seleccionar al menos una preferencia de contenido',
        en: 'At least one content preference must be selected',
        pt: 'Pelo menos uma preferência de conteúdo deve ser selecionada'
    },

    // -----------------------------------------------------------------------
    // entityComment (NEW namespace)
    // -----------------------------------------------------------------------
    {
        path: 'entityComment.authorId.invalidUuid',
        es: 'El ID del autor debe ser un UUID válido',
        en: 'Author ID must be a valid UUID',
        pt: 'O ID do autor deve ser um UUID válido'
    },
    {
        path: 'entityComment.authorId.required',
        es: 'El ID del autor es obligatorio',
        en: 'Author ID is required',
        pt: 'O ID do autor é obrigatório'
    },
    {
        path: 'entityComment.content.max',
        es: 'El contenido del comentario no puede superar los {{max}} caracteres',
        en: 'Comment content cannot exceed {{max}} characters',
        pt: 'O conteúdo do comentário não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'entityComment.content.min',
        es: 'El contenido del comentario debe tener al menos {{min}} caracteres',
        en: 'Comment content must be at least {{min}} characters',
        pt: 'O conteúdo do comentário deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'entityComment.content.required',
        es: 'El contenido del comentario es obligatorio',
        en: 'Comment content is required',
        pt: 'O conteúdo do comentário é obrigatório'
    },
    {
        path: 'entityComment.entityId.invalidUuid',
        es: 'El ID de la entidad debe ser un UUID válido',
        en: 'Entity ID must be a valid UUID',
        pt: 'O ID da entidade deve ser um UUID válido'
    },
    {
        path: 'entityComment.entityId.required',
        es: 'El ID de la entidad es obligatorio',
        en: 'Entity ID is required',
        pt: 'O ID da entidade é obrigatório'
    },
    {
        path: 'entityComment.eventId.invalidUuid',
        es: 'El ID del evento debe ser un UUID válido',
        en: 'Event ID must be a valid UUID',
        pt: 'O ID do evento deve ser um UUID válido'
    },
    {
        path: 'entityComment.moderationState.invalid',
        es: 'El estado de moderación no es válido',
        en: 'Moderation state is not valid',
        pt: 'O estado de moderação não é válido'
    },
    {
        path: 'entityComment.page.positive',
        es: 'La página debe ser un número positivo',
        en: 'Page must be a positive number',
        pt: 'A página deve ser um número positivo'
    },
    {
        path: 'entityComment.pageSize.max',
        es: 'El tamaño de página no puede superar los {{max}} elementos',
        en: 'Page size cannot exceed {{max}} items',
        pt: 'O tamanho da página não pode ultrapassar {{max}} itens'
    },
    {
        path: 'entityComment.pageSize.positive',
        es: 'El tamaño de página debe ser un número positivo',
        en: 'Page size must be a positive number',
        pt: 'O tamanho da página deve ser um número positivo'
    },
    {
        path: 'entityComment.postId.invalidUuid',
        es: 'El ID del post debe ser un UUID válido',
        en: 'Post ID must be a valid UUID',
        pt: 'O ID do post deve ser um UUID válido'
    },

    // -----------------------------------------------------------------------
    // enums.newsletterContentType
    // -----------------------------------------------------------------------
    {
        path: 'enums.newsletterContentType.invalid',
        es: 'El tipo de contenido del newsletter no es válido',
        en: 'Newsletter content type is not valid',
        pt: 'O tipo de conteúdo do newsletter não é válido'
    },

    // -----------------------------------------------------------------------
    // user
    // -----------------------------------------------------------------------
    {
        path: 'user.acceptedTerms.required',
        es: 'Debe aceptar los términos y condiciones',
        en: 'You must accept the terms and conditions',
        pt: 'Você deve aceitar os termos e condições'
    },
    {
        path: 'user.bio.max',
        es: 'La biografía no puede superar los {{max}} caracteres',
        en: 'Bio cannot exceed {{max}} characters',
        pt: 'A biografia não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'user.bio.min',
        es: 'La biografía debe tener al menos {{min}} caracteres',
        en: 'Bio must be at least {{min}} characters',
        pt: 'A biografia deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'user.imageUrl.url',
        es: 'La URL de la imagen no es válida',
        en: 'Image URL is not valid',
        pt: 'A URL da imagem não é válida'
    },
    {
        path: 'user.occupation.max',
        es: 'La ocupación no puede superar los {{max}} caracteres',
        en: 'Occupation cannot exceed {{max}} characters',
        pt: 'A ocupação não pode ultrapassar {{max}} caracteres'
    },
    {
        path: 'user.occupation.min',
        es: 'La ocupación debe tener al menos {{min}} caracteres',
        en: 'Occupation must be at least {{min}} characters',
        pt: 'A ocupação deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'user.password.min',
        es: 'La contraseña debe tener al menos {{min}} caracteres',
        en: 'Password must be at least {{min}} characters',
        pt: 'A senha deve ter pelo menos {{min}} caracteres'
    },
    {
        path: 'user.password.required',
        es: 'La contraseña es obligatoria',
        en: 'Password is required',
        pt: 'A senha é obrigatória'
    },
    {
        path: 'user.profile.birthDate.format',
        es: 'El formato de la fecha de nacimiento no es válido',
        en: 'Birth date format is not valid',
        pt: 'O formato da data de nascimento não é válido'
    },
    {
        path: 'user.website.url',
        es: 'El sitio web no es válido',
        en: 'Website URL is not valid',
        pt: 'O site não é válido'
    }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sets a value at a nested path inside an object, creating intermediate
 * objects as needed. Does NOT overwrite a key that already exists.
 */
function setNested(obj: JsonObject, path: string[], value: string): void {
    const [head, ...rest] = path;
    if (head === undefined) return;

    if (rest.length === 0) {
        // Leaf — only write if absent
        if (!(head in obj)) {
            obj[head] = value;
        }
        return;
    }

    if (!(head in obj)) {
        obj[head] = {};
    }
    const child = obj[head];
    if (typeof child !== 'object' || child === null || Array.isArray(child)) {
        throw new Error(`Path collision at key "${head}": expected object, got ${typeof child}`);
    }
    setNested(child as JsonObject, rest, value);
}

/**
 * Reads, patches and writes a locale validation.json in place.
 */
function patchLocale(filePath: string, lang: 'es' | 'en' | 'pt'): number {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as JsonObject;

    let added = 0;
    for (const entry of MISSING_KEYS) {
        const segments = entry.path.split('.');
        const before = JSON.stringify(data);
        setNested(data, segments, entry[lang]);
        if (JSON.stringify(data) !== before) added++;
    }

    // Preserve 4-space indent + trailing newline
    writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`, 'utf-8');
    return added;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const root = new URL('..', import.meta.url).pathname;
const localesDir = join(root, 'packages/i18n/src/locales');

for (const lang of ['es', 'en', 'pt'] as const) {
    const filePath = join(localesDir, lang, 'validation.json');
    const added = patchLocale(filePath, lang);
    console.log(`[${lang}] Added ${added} keys → ${filePath}`);
}

console.log('\nDone. Run: pnpm tsx scripts/extract-zod-keys.ts --verify');
