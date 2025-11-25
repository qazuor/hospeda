import {
    ClientModel,
    PricingPlanModel,
    ProductModel,
    SubscriptionModel,
    UserModel
} from '@repo/db';
import type { Client, PricingPlan, Product, RoleEnum, Subscription, User } from '@repo/schemas';

/**
 * E2E test data seeding helpers
 * Provides utilities to create test data for E2E scenarios
 */

/**
 * Create a test user with optional overrides
 * @param overrides - Partial user data to override defaults
 * @returns Created user
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
    const userModel = new UserModel();

    const timestamp = Date.now();
    const defaultData = {
        clerkId: overrides?.clerkId || `test_clerk_${timestamp}`,
        email: overrides?.email || `test-user-${timestamp}@example.com`,
        slug: overrides?.slug || `test-user-${timestamp}`,
        firstName: overrides?.firstName || 'Test',
        lastName: overrides?.lastName || 'User',
        role: overrides?.role || ('USER' as RoleEnum),
        permissions: overrides?.permissions || [],
        settings: overrides?.settings || {
            notifications: {
                enabled: true,
                allowEmails: true,
                allowSms: false,
                allowPush: false
            }
        },
        ...overrides
    };

    const result = await userModel.create(defaultData as any);
    return result as User;
}

/**
 * Create a test client with optional overrides
 * @param overrides - Partial client data to override defaults
 * @returns Created client
 */
export async function createTestClient(overrides?: Partial<Client>): Promise<Client> {
    const clientModel = new ClientModel();

    const defaultData = {
        name: overrides?.name || `Test Client ${Date.now()}`,
        billingEmail: overrides?.billingEmail || `test-${Date.now()}@example.com`,
        userId: null,
        ...overrides
    };

    const result = await clientModel.create(defaultData as any);
    return result as Client;
}

/**
 * Create a test product
 * @param overrides - Partial product data to override defaults
 * @returns Created product
 */
export async function createTestProduct(overrides?: Partial<Product>): Promise<Product> {
    const productModel = new ProductModel();

    const defaultData = {
        name: overrides?.name || `Test Product ${Date.now()}`,
        description: overrides?.description || 'Test product description',
        type: overrides?.type || ('listing_plan' as const), // Default to listing_plan for test subscriptions
        ...overrides
    };

    const result = await productModel.create(defaultData as any);
    return result as Product;
}

/**
 * Create a test pricing plan (creates product first if not provided)
 * @param overrides - Partial plan data to override defaults
 * @returns Created plan
 */
export async function createTestPlan(overrides?: Partial<PricingPlan>): Promise<PricingPlan> {
    const planModel = new PricingPlanModel();

    // Create a product first if productId is not provided
    let productId = overrides?.productId;
    if (!productId) {
        const product = await createTestProduct();
        productId = product.id;
    }

    const defaultData = {
        productId,
        billingScheme: 'recurring' as const, // Use enum value directly
        interval: 'month' as const, // Use enum value directly
        amount: 1000,
        currency: 'ARS',
        ...overrides
    };

    const result = await planModel.create(defaultData as any);
    return result as PricingPlan;
}

/**
 * Create a test subscription
 * @param clientId - Client ID for the subscription
 * @param pricingPlanId - Pricing plan ID for the subscription
 * @param overrides - Partial subscription data to override defaults
 * @returns Created subscription
 */
export async function createTestSubscription(
    clientId: string,
    pricingPlanId: string,
    overrides?: Partial<Subscription>
): Promise<Subscription> {
    const subscriptionModel = new SubscriptionModel();

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month from now

    const defaultData = {
        clientId,
        pricingPlanId,
        startDate: now,
        endDate,
        status: 'active' as const, // Default status
        ...overrides
    };

    const result = await subscriptionModel.create(defaultData as any);
    return result as Subscription;
}

/**
 * Create a complete subscription flow setup
 * Returns client, plan, and subscription
 */
export async function setupSubscriptionFlow() {
    const client = await createTestClient();
    const plan = await createTestPlan();
    const subscription = await createTestSubscription(client.id, plan.id);

    return { client, plan, subscription };
}

/**
 * Create multiple test clients
 * @param count - Number of clients to create
 * @param baseOverrides - Base overrides to apply to all clients
 * @returns Array of created clients
 */
export async function createTestClients(
    count: number,
    baseOverrides?: Partial<Client>
): Promise<Client[]> {
    const clients: Client[] = [];

    for (let i = 0; i < count; i++) {
        const client = await createTestClient({
            ...baseOverrides,
            name: `${baseOverrides?.name || 'Test Client'} ${i + 1}`,
            billingEmail: `test-${i + 1}-${Date.now()}@example.com`
        });
        clients.push(client);
    }

    return clients;
}

/**
 * Create multiple test plans
 * @param count - Number of plans to create
 * @param baseOverrides - Base overrides to apply to all plans
 * @returns Array of created plans
 */
export async function createTestPlans(
    count: number,
    baseOverrides?: Partial<PricingPlan>
): Promise<PricingPlan[]> {
    const plans: PricingPlan[] = [];

    for (let i = 0; i < count; i++) {
        const plan = await createTestPlan({
            ...baseOverrides,
            amount: (baseOverrides?.amount || 1000) + i * 500
        });
        plans.push(plan);
    }

    return plans;
}
