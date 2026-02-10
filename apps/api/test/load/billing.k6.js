/**
 * K6 Load Testing Script - Billing Endpoints
 *
 * Tests performance of Hospeda billing endpoints with realistic user scenarios.
 *
 * Requirements (F5-001):
 * - P99 latency < 500ms for critical endpoints
 * - Gradual load increase to simulate real-world traffic patterns
 * - Error rate monitoring and thresholds
 *
 * Usage:
 *   k6 run test/load/billing.k6.js
 *   k6 run --out json=results.json test/load/billing.k6.js
 *   k6 run --vus 50 --duration 5m test/load/billing.k6.js
 *
 * @module test/load/billing
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';
const API_VERSION = '/api/v1';
const BILLING_PATH = `${API_VERSION}/billing`;

// Mock JWT token for testing
// In production, this would be a real Clerk token
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'mock-jwt-token-for-load-testing';

// =============================================================================
// Custom Metrics
// =============================================================================

// Error tracking
const errorRate = new Rate('error_rate');
const authErrors = new Counter('auth_errors');
const validationErrors = new Counter('validation_errors');
const serverErrors = new Counter('server_errors');

// Endpoint-specific metrics
const subscriptionListLatency = new Trend('subscription_list_latency');
const subscriptionGetLatency = new Trend('subscription_get_latency');
const checkoutCreateLatency = new Trend('checkout_create_latency');
const invoiceListLatency = new Trend('invoice_list_latency');
const promoRedeemLatency = new Trend('promo_redeem_latency');
const metricsGetLatency = new Trend('metrics_get_latency');
const trialStartLatency = new Trend('trial_start_latency');

// Success counters
const successfulRequests = new Counter('successful_requests');
const totalRequests = new Counter('total_requests');

// =============================================================================
// Test Configuration
// =============================================================================

export const options = {
    // Define test stages (ramp up, sustained, ramp down)
    stages: [
        { duration: '2m', target: 10 }, // Warm up - ramp to 10 users
        { duration: '5m', target: 50 }, // Ramp up - increase to 50 users
        { duration: '10m', target: 50 }, // Sustained - hold at 50 users
        { duration: '3m', target: 100 }, // Spike - increase to 100 users
        { duration: '5m', target: 100 }, // Sustained spike - hold at 100 users
        { duration: '5m', target: 20 }, // Ramp down - decrease to 20 users
        { duration: '2m', target: 0 } // Cool down - ramp to 0 users
    ],

    // Performance thresholds (test will fail if these are not met)
    thresholds: {
        // Global thresholds
        http_req_duration: ['p(95)<500', 'p(99)<800'], // 95% < 500ms, 99% < 800ms
        http_req_failed: ['rate<0.05'], // Error rate < 5%
        error_rate: ['rate<0.05'], // Custom error rate < 5%

        // Critical endpoint thresholds (P99 < 500ms)
        subscription_list_latency: ['p(95)<300', 'p(99)<500'],
        subscription_get_latency: ['p(95)<200', 'p(99)<400'],
        checkout_create_latency: ['p(95)<400', 'p(99)<600'],
        invoice_list_latency: ['p(95)<300', 'p(99)<500'],

        // Non-critical endpoint thresholds (slightly relaxed)
        promo_redeem_latency: ['p(95)<400', 'p(99)<700'],
        metrics_get_latency: ['p(95)<500', 'p(99)<800'],
        trial_start_latency: ['p(95)<500', 'p(99)<800'],

        // Specific error thresholds
        auth_errors: ['count<10'],
        server_errors: ['count<20']
    },

    // Test execution options
    noConnectionReuse: false,
    userAgent: 'K6LoadTest/1.0',
    batch: 10,
    batchPerHost: 5,

    // Tags for result filtering
    tags: {
        testType: 'load',
        environment: 'test',
        app: 'billing-api'
    }
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create HTTP request headers with authentication
 *
 * @returns {Object} Headers object
 */
function createHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
        Accept: 'application/json'
    };
}

/**
 * Validate response and track metrics
 *
 * @param {Object} response - HTTP response
 * @param {string} endpoint - Endpoint name
 * @param {Trend} latencyMetric - Latency metric to update
 * @param {Object} checks - Check definitions
 * @returns {boolean} Whether all checks passed
 */
function validateResponse(response, _endpoint, latencyMetric, checks = {}) {
    totalRequests.add(1);

    // Track latency
    if (latencyMetric) {
        latencyMetric.add(response.timings.duration);
    }

    // Default checks
    const defaultChecks = {
        'status is not 500': (r) => r.status !== 500,
        'response has body': (r) => r.body && r.body.length > 0
    };

    // Merge with custom checks
    const allChecks = Object.assign({}, defaultChecks, checks);

    // Perform checks
    const checkResult = check(response, allChecks);

    // Track errors
    if (checkResult) {
        successfulRequests.add(1);
        errorRate.add(0);
    } else {
        errorRate.add(1);

        if (response.status === 401 || response.status === 403) {
            authErrors.add(1);
        } else if (response.status === 400 || response.status === 422) {
            validationErrors.add(1);
        } else if (response.status >= 500) {
            serverErrors.add(1);
        }
    }

    return checkResult;
}

/**
 * Generate random subscription ID for testing
 *
 * @returns {string} UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Generate realistic test data
 */
const testData = {
    planIds: [
        'owner-free-trial',
        'owner-basic-monthly',
        'owner-premium-monthly',
        'complex-premium-monthly'
    ],
    promoCodes: ['WELCOME10', 'SUMMER20', 'TRIAL50'],
    userTypes: ['owner', 'complex']
};

// =============================================================================
// Test Scenarios
// =============================================================================

/**
 * Scenario 1: Browse Subscriptions
 * Simulates a user viewing their subscriptions
 */
function browseSubscriptions() {
    group('Browse Subscriptions', () => {
        // List all subscriptions
        const listResponse = http.get(`${BASE_URL}${BILLING_PATH}/subscriptions`, {
            headers: createHeaders()
        });

        validateResponse(listResponse, 'GET /subscriptions', subscriptionListLatency, {
            'status is 200': (r) => r.status === 200,
            'has subscriptions array': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return Array.isArray(body) || (body.data && Array.isArray(body.data));
                } catch (_e) {
                    return false;
                }
            }
        });

        // If subscriptions exist, get details of first one
        if (listResponse.status === 200) {
            try {
                const body = JSON.parse(listResponse.body);
                const subscriptions = Array.isArray(body) ? body : body.data;

                if (subscriptions && subscriptions.length > 0) {
                    const subscriptionId = subscriptions[0].id;

                    sleep(0.5); // User thinks for 0.5s

                    const getResponse = http.get(
                        `${BASE_URL}${BILLING_PATH}/subscriptions/${subscriptionId}`,
                        { headers: createHeaders() }
                    );

                    validateResponse(
                        getResponse,
                        'GET /subscriptions/:id',
                        subscriptionGetLatency,
                        {
                            'status is 200': (r) => r.status === 200,
                            'has subscription data': (r) => {
                                try {
                                    const data = JSON.parse(r.body);
                                    return data.id === subscriptionId;
                                } catch (_e) {
                                    return false;
                                }
                            }
                        }
                    );
                }
            } catch (e) {
                console.error('Error parsing subscription list:', e);
            }
        }
    });
}

/**
 * Scenario 2: Checkout Flow
 * Simulates a user going through checkout process
 */
function checkoutFlow() {
    group('Checkout Flow', () => {
        // Select a random plan
        const planId = testData.planIds[Math.floor(Math.random() * testData.planIds.length)];

        // Create checkout session
        const checkoutPayload = JSON.stringify({
            planId: planId,
            billingCycle: 'monthly',
            successUrl: 'https://hospeda.com/billing/success',
            cancelUrl: 'https://hospeda.com/billing/cancel'
        });

        const checkoutResponse = http.post(`${BASE_URL}${BILLING_PATH}/checkout`, checkoutPayload, {
            headers: createHeaders()
        });

        validateResponse(checkoutResponse, 'POST /checkout', checkoutCreateLatency, {
            'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
            'has checkout session': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return data.id || data.sessionId || data.checkoutUrl;
                } catch (_e) {
                    return false;
                }
            }
        });

        // 30% chance to try applying a promo code
        if (Math.random() < 0.3) {
            sleep(1); // User thinks about promo code

            const promoCode =
                testData.promoCodes[Math.floor(Math.random() * testData.promoCodes.length)];
            const checkoutId = generateUUID(); // Mock checkout ID

            const promoPayload = JSON.stringify({
                code: promoCode,
                checkoutId: checkoutId
            });

            const promoResponse = http.post(
                `${BASE_URL}${BILLING_PATH}/promo-codes/apply`,
                promoPayload,
                { headers: createHeaders() }
            );

            validateResponse(promoResponse, 'POST /promo-codes/apply', promoRedeemLatency, {
                'status is 200 or 400': (r) => r.status === 200 || r.status === 400
                // 400 is acceptable - promo code might be invalid
            });
        }
    });
}

/**
 * Scenario 3: View Invoices
 * Simulates a user checking their billing history
 */
function viewInvoices() {
    group('View Invoices', () => {
        const invoiceResponse = http.get(`${BASE_URL}${BILLING_PATH}/invoices?limit=20&page=1`, {
            headers: createHeaders()
        });

        validateResponse(invoiceResponse, 'GET /invoices', invoiceListLatency, {
            'status is 200': (r) => r.status === 200,
            'has invoices array': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return Array.isArray(body) || (body.data && Array.isArray(body.data));
                } catch (_e) {
                    return false;
                }
            }
        });
    });
}

/**
 * Scenario 4: Start Trial (less frequent)
 * Simulates a new user starting a trial
 */
function startTrial() {
    group('Start Trial', () => {
        const userType = testData.userTypes[Math.floor(Math.random() * testData.userTypes.length)];

        const trialPayload = JSON.stringify({
            userType: userType
        });

        const trialResponse = http.post(`${BASE_URL}${BILLING_PATH}/trial/start`, trialPayload, {
            headers: createHeaders()
        });

        validateResponse(trialResponse, 'POST /trial/start', trialStartLatency, {
            'status is 200 or 201 or 409': (r) => [200, 201, 409].includes(r.status),
            // 409 is acceptable - user might already have a trial
            'has response data': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return typeof data.success === 'boolean';
                } catch (_e) {
                    return false;
                }
            }
        });
    });
}

/**
 * Scenario 5: Admin Metrics View (less frequent)
 * Simulates an admin viewing billing metrics
 */
function viewMetrics() {
    group('View Metrics', () => {
        const metricsResponse = http.get(`${BASE_URL}${BILLING_PATH}/metrics?livemode=true`, {
            headers: createHeaders()
        });

        validateResponse(metricsResponse, 'GET /metrics', metricsGetLatency, {
            'status is 200': (r) => r.status === 200,
            'has overview data': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return data.overview && typeof data.overview.mrr === 'number';
                } catch (_e) {
                    return false;
                }
            }
        });
    });
}

// =============================================================================
// Main Test Function
// =============================================================================

/**
 * Main test execution
 * Randomly selects scenarios to simulate realistic user behavior
 */
export default function () {
    // Randomly select which scenario to run
    // Weight scenarios by typical usage patterns
    const random = Math.random();

    if (random < 0.4) {
        // 40% - Most common: browsing subscriptions
        browseSubscriptions();
    } else if (random < 0.7) {
        // 30% - Checkout flow
        checkoutFlow();
    } else if (random < 0.85) {
        // 15% - View invoices
        viewInvoices();
    } else if (random < 0.95) {
        // 10% - Start trial
        startTrial();
    } else {
        // 5% - View metrics (admin action)
        viewMetrics();
    }

    // Think time between requests (0.5-3 seconds)
    sleep(Math.random() * 2.5 + 0.5);
}

// =============================================================================
// Lifecycle Functions
// =============================================================================

/**
 * Setup function - runs once before test
 */
export function setup() {
    // Validate API is reachable
    const healthCheck = http.get(`${BASE_URL}/health`);

    if (healthCheck.status !== 200) {
        console.error('❌ API health check failed. Please ensure the API is running.');
        return;
    }

    return {
        startTime: new Date().toISOString()
    };
}

/**
 * Teardown function - runs once after test
 *
 * @param {Object} data - Data from setup function
 */
export function teardown(_data) {}

// =============================================================================
// Test Summary Handler
// =============================================================================

/**
 * Handle test summary
 * Runs after test completion to display custom summary
 *
 * @param {Object} data - Test summary data
 * @returns {Object} Custom summary
 */
export function handleSummary(data) {
    // Calculate pass/fail based on thresholds
    const thresholdsPassed = Object.keys(data.metrics)
        .filter((metric) => data.metrics[metric].thresholds)
        .every((metric) => {
            const thresholds = data.metrics[metric].thresholds;
            return Object.keys(thresholds).every((threshold) => thresholds[threshold].ok);
        });

    const summary = {
        stdout: `
╔════════════════════════════════════════════════════════════════╗
║            BILLING ENDPOINTS LOAD TEST SUMMARY                 ║
╚════════════════════════════════════════════════════════════════╝

📊 Overall Results: ${thresholdsPassed ? '✅ PASSED' : '❌ FAILED'}

🎯 Performance Metrics:
   • Total Requests: ${data.metrics.http_reqs.values.count}
   • Success Rate: ${((successfulRequests.values.count / totalRequests.values.count) * 100).toFixed(2)}%
   • Error Rate: ${(errorRate.values.rate * 100).toFixed(2)}%
   • Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
   • P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
   • P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms

🔍 Endpoint-Specific Latencies (P99):
   • Subscription List: ${subscriptionListLatency.values ? subscriptionListLatency.values['p(99)'].toFixed(2) : 'N/A'}ms
   • Subscription Get: ${subscriptionGetLatency.values ? subscriptionGetLatency.values['p(99)'].toFixed(2) : 'N/A'}ms
   • Checkout Create: ${checkoutCreateLatency.values ? checkoutCreateLatency.values['p(99)'].toFixed(2) : 'N/A'}ms
   • Invoice List: ${invoiceListLatency.values ? invoiceListLatency.values['p(99)'].toFixed(2) : 'N/A'}ms
   • Promo Redeem: ${promoRedeemLatency.values ? promoRedeemLatency.values['p(99)'].toFixed(2) : 'N/A'}ms
   • Metrics Get: ${metricsGetLatency.values ? metricsGetLatency.values['p(99)'].toFixed(2) : 'N/A'}ms
   • Trial Start: ${trialStartLatency.values ? trialStartLatency.values['p(99)'].toFixed(2) : 'N/A'}ms

⚠️  Errors:
   • Auth Errors: ${authErrors.values.count}
   • Validation Errors: ${validationErrors.values.count}
   • Server Errors: ${serverErrors.values.count}

🎯 Threshold Compliance:
   • P99 < 500ms (critical endpoints): ${data.metrics.http_req_duration.values['p(99)'] < 500 ? '✅' : '❌'}
   • Error rate < 5%: ${errorRate.values.rate < 0.05 ? '✅' : '❌'}
   • No auth errors: ${authErrors.values.count === 0 ? '✅' : '❌'}

╚════════════════════════════════════════════════════════════════╝
`
    };

    return summary;
}
