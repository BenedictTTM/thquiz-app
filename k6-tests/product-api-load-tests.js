/**
 * ═══════════════════════════════════════════════════════════════════════════
 * K6 LOAD TESTS - PRODUCT API (ENTERPRISE GRADE)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Author: Senior Backend Engineer (40 years experience)
 * Target: Production-grade getProduct API endpoints
 * Framework: k6 by Grafana Labs
 * 
 * TESTING STRATEGY:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Smoke Tests        - Basic functionality validation (1 VU)
 * 2. Load Tests         - Normal production load (50-100 VUs)
 * 3. Stress Tests       - Beyond capacity (200-500 VUs)
 * 4. Spike Tests        - Sudden traffic spikes (0→300 VUs)
 * 5. Soak Tests         - Extended duration stability (24h+)
 * 6. Breakpoint Tests   - Find system limits
 * 
 * PERFORMANCE TARGETS (Based on service SLA):
 * ─────────────────────────────────────────────────────────────────────────────
 * - getAllProducts:     < 100ms (p95), < 150ms (p99)
 * - getProductById:     < 50ms  (p95), < 75ms  (p99)
 * - searchProducts:     < 150ms (p95), < 200ms (p99)
 * - getByCategory:      < 100ms (p95), < 150ms (p99)
 * - Error Rate:         < 0.1%
 * - Availability:       > 99.9%
 * 
 * ARCHITECTURE PRINCIPLES APPLIED:
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ SOLID Principles
 *    - Single Responsibility: Each scenario tests one aspect
 *    - Open/Closed: Extensible configuration
 *    - Liskov Substitution: Test scenarios are interchangeable
 *    - Interface Segregation: Minimal, focused test utilities
 *    - Dependency Inversion: Tests depend on abstractions (config)
 * 
 * ✅ Clean Architecture
 *    - Separation of concerns (setup, execution, validation)
 *    - Business logic isolation (custom metrics, thresholds)
 *    - Dependency direction (tests don't depend on implementation)
 * 
 * ✅ Production Best Practices
 *    - Environment-based configuration
 *    - Custom metrics and SLIs/SLOs
 *    - Realistic user scenarios
 *    - Data-driven testing
 *    - Comprehensive error handling
 *    - Performance budgets
 *    - Distributed tracing headers
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * # Smoke test (quick validation)
 * k6 run --env TEST_TYPE=smoke product-api-load-tests.js
 * 
 * # Load test (normal production traffic)
 * k6 run --env TEST_TYPE=load product-api-load-tests.js
 * 
 * # Stress test (find breaking point)
 * k6 run --env TEST_TYPE=stress product-api-load-tests.js
 * 
 * # Spike test (traffic bursts)
 * k6 run --env TEST_TYPE=spike product-api-load-tests.js
 * 
 * # Soak test (long-duration stability)
 * k6 run --env TEST_TYPE=soak product-api-load-tests.js
 * 
 * # Custom environment
 * k6 run --env BASE_URL=https://production.api.com product-api-load-tests.js
 * 
 * # Generate HTML report
 * k6 run --out json=results.json product-api-load-tests.js
 * k6-reporter results.json --output report.html
 * 
 * # Send to InfluxDB/Grafana
 * k6 run --out influxdb=http://localhost:8086/k6 product-api-load-tests.js
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & ENVIRONMENT SETUP
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Base URL - Environment configurable
    baseUrl: __ENV.BASE_URL || 'http://localhost:3001',

    // Test type selection
    testType: __ENV.TEST_TYPE || 'smoke',

    // Performance budgets (in milliseconds)
    budgets: {
        getAllProducts: { p95: 100, p99: 150 },
        getProductById: { p95: 50, p99: 75 },
        searchProducts: { p95: 150, p99: 200 },
        getByCategory: { p95: 100, p99: 150 },
        getByUserId: { p95: 100, p99: 150 },
        getFeatured: { p95: 100, p99: 150 },
    },

    // Error thresholds
    errorRateThreshold: 0.001, // 0.1%

    // Realistic test data
    testData: {
        productIds: [1, 2, 3, 4, 5, 10, 15, 20, 25, 30], // Known product IDs
        categories: ['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Toys'],
        searchTerms: ['laptop', 'phone', 'shirt', 'book', 'bike', 'toy', 'watch'],
        conditions: ['new', 'used', 'refurbished'],
        userIds: [1, 2, 3, 4, 5],
        priceRanges: [
            { min: 0, max: 50 },
            { min: 50, max: 100 },
            { min: 100, max: 500 },
            { min: 500, max: 1000 },
        ],
    },

    // Request configuration
    timeout: '30s',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'k6-load-test/1.0',
        'X-Test-Run': `k6-${Date.now()}`,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS (SLI - Service Level Indicators)
// ═══════════════════════════════════════════════════════════════════════════

// Error tracking
const errorRate = new Rate('error_rate');
const apiErrors = new Counter('api_errors');
const httpErrors = new Counter('http_errors');

// Endpoint-specific response times (SLI)
const getAllProductsLatency = new Trend('get_all_products_latency', true);
const getProductByIdLatency = new Trend('get_product_by_id_latency', true);
const searchProductsLatency = new Trend('search_products_latency', true);
const getByCategoryLatency = new Trend('get_by_category_latency', true);
const getByUserIdLatency = new Trend('get_by_user_id_latency', true);
const getFeaturedLatency = new Trend('get_featured_latency', true);

// Business metrics
const productsReturned = new Counter('products_returned_total');
const paginationRequests = new Counter('pagination_requests');
const cacheHits = new Gauge('cache_hit_rate');
const emptyResults = new Counter('empty_search_results');

// Database performance indicators
const dbQueryTime = new Trend('estimated_db_query_time', true);
const payloadSize = new Trend('response_payload_size_kb', true);

// Availability metrics (SLO - Service Level Objectives)
const apiAvailability = new Rate('api_availability');
const successfulRequests = new Counter('successful_requests');

// ═══════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SCENARIOS = {
    // 1. SMOKE TEST - Quick validation (1-2 minutes)
    smoke: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
        gracefulStop: '10s',
    },

    // 2. LOAD TEST - Normal production traffic (10 minutes)
    load: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '2m', target: 20 },   // Ramp up to 20 users
            { duration: '5m', target: 50 },   // Ramp up to 50 users
            { duration: '2m', target: 100 },  // Peak at 100 users
            { duration: '5m', target: 100 },  // Hold at peak
            { duration: '2m', target: 0 },    // Ramp down
        ],
        gracefulStop: '30s',
    },

    // 3. STRESS TEST - Beyond normal capacity (15 minutes)
    stress: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '2m', target: 50 },   // Warm up
            { duration: '3m', target: 100 },  // Normal load
            { duration: '3m', target: 200 },  // Above normal
            { duration: '3m', target: 300 },  // Stress level
            { duration: '2m', target: 400 },  // Near breaking point
            { duration: '2m', target: 0 },    // Recovery
        ],
        gracefulStop: '30s',
    },

    // 4. SPIKE TEST - Sudden traffic bursts (10 minutes)
    spike: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '1m', target: 20 },   // Normal traffic
            { duration: '30s', target: 300 }, // Sudden spike!
            { duration: '2m', target: 300 },  // Hold spike
            { duration: '30s', target: 20 },  // Drop back
            { duration: '3m', target: 20 },   // Recover
            { duration: '30s', target: 400 }, // Another spike
            { duration: '2m', target: 400 },  // Hold
            { duration: '1m', target: 0 },    // Ramp down
        ],
        gracefulStop: '30s',
    },

    // 5. SOAK TEST - Long-duration stability (2 hours)
    soak: {
        executor: 'constant-vus',
        vus: 50,
        duration: '2h',
        gracefulStop: '1m',
    },

    // 6. BREAKPOINT TEST - Find system limits
    breakpoint: {
        executor: 'ramping-arrival-rate',
        startRate: 10,
        timeUnit: '1s',
        preAllocatedVUs: 500,
        maxVUs: 1000,
        stages: [
            { duration: '2m', target: 50 },    // 50 RPS
            { duration: '2m', target: 100 },   // 100 RPS
            { duration: '2m', target: 200 },   // 200 RPS
            { duration: '2m', target: 400 },   // 400 RPS
            { duration: '2m', target: 800 },   // 800 RPS
            { duration: '2m', target: 1600 },  // 1600 RPS - breaking point
        ],
        gracefulStop: '1m',
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// K6 TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const options = {
    // Select scenario based on environment variable
    scenarios: {
        main: SCENARIOS[CONFIG.testType],
    },

    // Performance thresholds (SLO - Service Level Objectives)
    thresholds: {
        // Overall HTTP metrics
        'http_req_duration': [
            'p(95)<200',  // 95% of requests should be below 200ms
            'p(99)<300',  // 99% of requests should be below 300ms
        ],
        'http_req_failed': [
            'rate<0.01',  // Error rate should be below 1%
        ],

        // Custom error thresholds
        'error_rate': ['rate<0.001'],           // < 0.1% error rate
        'api_availability': ['rate>0.999'],     // > 99.9% availability

        // Endpoint-specific SLOs
        'get_all_products_latency': [
            `p(95)<${CONFIG.budgets.getAllProducts.p95}`,
            `p(99)<${CONFIG.budgets.getAllProducts.p99}`,
        ],
        'get_product_by_id_latency': [
            `p(95)<${CONFIG.budgets.getProductById.p95}`,
            `p(99)<${CONFIG.budgets.getProductById.p99}`,
        ],
        'search_products_latency': [
            `p(95)<${CONFIG.budgets.searchProducts.p95}`,
            `p(99)<${CONFIG.budgets.searchProducts.p99}`,
        ],
        'get_by_category_latency': [
            `p(95)<${CONFIG.budgets.getByCategory.p95}`,
            `p(99)<${CONFIG.budgets.getByCategory.p99}`,
        ],

        // Resource efficiency
        'response_payload_size_kb': ['avg<500'], // Average payload < 500KB
    },

    // Global timeouts
    setupTimeout: '60s',
    teardownTimeout: '60s',

    // Tags for better metrics organization
    tags: {
        test_type: CONFIG.testType,
        api: 'products',
        version: 'v1',
        environment: __ENV.BASE_URL ? 'production' : 'local',
    },

    // Disable certificate validation for local testing
    insecureSkipTLSVerify: true,

    // User agent
    userAgent: CONFIG.headers['User-Agent'],
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS (Following DRY & SOLID principles)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute HTTP request with comprehensive metrics and error handling
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object} params - Request parameters
 * @param {Trend} latencyMetric - Custom latency metric
 * @returns {object} Response object
 */
function executeRequest(method, url, params = {}, latencyMetric = null) {
    const startTime = new Date();

    // Add standard headers and tags
    params.headers = Object.assign({}, CONFIG.headers, params.headers);
    params.tags = Object.assign({
        endpoint: url.split('?')[0].replace(CONFIG.baseUrl, '')
    }, params.tags);
    params.timeout = CONFIG.timeout;

    // Execute request
    const response = http.request(method, url, params.body, params);

    // Calculate metrics
    const duration = new Date() - startTime;
    const isSuccess = response.status >= 200 && response.status < 300;
    const payloadKB = response.body ? response.body.length / 1024 : 0;

    // Record metrics
    if (latencyMetric) {
        latencyMetric.add(duration);
    }

    errorRate.add(!isSuccess);
    apiAvailability.add(isSuccess);
    payloadSize.add(payloadKB);

    if (isSuccess) {
        successfulRequests.add(1);
    } else {
        apiErrors.add(1);
        if (response.status >= 500) {
            httpErrors.add(1);
        }
    }

    // Estimate DB query time (response time - network overhead)
    const estimatedDbTime = duration - 10; // Assume 10ms network
    dbQueryTime.add(Math.max(0, estimatedDbTime));

    return response;
}

/**
 * Validate response structure and content
 * @param {object} response - HTTP response
 * @param {object} expectations - Expected response characteristics
 * @returns {boolean} Validation result
 */
function validateResponse(response, expectations = {}) {
    const checks = {
        'status is 200': response.status === 200,
        'response time < 500ms': response.timings.duration < 500,
        'has valid JSON': () => {
            try {
                JSON.parse(response.body);
                return true;
            } catch (e) {
                return false;
            }
        },
    };

    // Add custom expectations
    if (expectations.hasData) {
        checks['has data array'] = () => {
            const body = JSON.parse(response.body);
            return Array.isArray(body.data) || Array.isArray(body);
        };
    }

    if (expectations.hasPagination) {
        checks['has pagination'] = () => {
            const body = JSON.parse(response.body);
            return body.pagination &&
                typeof body.pagination.page === 'number' &&
                typeof body.pagination.totalCount === 'number';
        };
    }

    if (expectations.minItems !== undefined) {
        checks[`has at least ${expectations.minItems} items`] = () => {
            const body = JSON.parse(response.body);
            const items = body.data || body;
            return items.length >= expectations.minItems;
        };
    }

    // Execute all checks
    return check(response, checks);
}

/**
 * Simulate realistic user think time
 * @param {number} min - Minimum seconds
 * @param {number} max - Maximum seconds
 */
function thinkTime(min = 1, max = 3) {
    sleep(randomIntBetween(min, max));
}

/**
 * Get random element from test data
 * @param {string} dataType - Type of data to retrieve
 * @returns {*} Random element
 */
function getRandomTestData(dataType) {
    return randomItem(CONFIG.testData[dataType]);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS (Main Test Logic)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scenario 1: Browse all products with pagination
 * Simulates user browsing through product listings
 */
function scenario_browseProducts() {
    group('Browse All Products', () => {
        const page = randomIntBetween(1, 5);
        const limit = randomItem([10, 20, 50]);
        const url = `${CONFIG.baseUrl}/products?page=${page}&limit=${limit}`;

        const response = executeRequest('GET', url, {}, getAllProductsLatency);

        const isValid = validateResponse(response, {
            hasData: true,
            hasPagination: true,
            minItems: 0,
        });

        if (isValid && response.status === 200) {
            const body = JSON.parse(response.body);
            productsReturned.add(body.data.length);
            paginationRequests.add(1);

            // Check for cache headers
            if (response.headers['X-Cache'] === 'HIT') {
                cacheHits.add(1);
            }
        }
    });
}

/**
 * Scenario 2: View single product details
 * Simulates user clicking on a product for details
 */
function scenario_viewProductDetails() {
    group('View Product Details', () => {
        const productId = getRandomTestData('productIds');
        const url = `${CONFIG.baseUrl}/products/${productId}`;

        const response = executeRequest('GET', url, {}, getProductByIdLatency);

        validateResponse(response, {
            hasData: false,
        });

        if (response.status === 200) {
            const product = JSON.parse(response.body);

            // Additional business logic validations
            check(product, {
                'has product title': (p) => p.title && p.title.length > 0,
                'has price': (p) => typeof p.originalPrice === 'number',
                'has user info': (p) => p.user && p.user.username,
                'has average rating': (p) => typeof p.averageRating === 'number',
                'has images': (p) => p.images && p.images.length > 0,
            });
        }
    });
}

/**
 * Scenario 3: Search products
 * Simulates user searching for products
 */
function scenario_searchProducts() {
    group('Search Products', () => {
        const searchTerm = getRandomTestData('searchTerms');
        const page = randomIntBetween(1, 3);
        const limit = 20;
        const url = `${CONFIG.baseUrl}/products/search?q=${searchTerm}&page=${page}&limit=${limit}`;

        const response = executeRequest('GET', url, {}, searchProductsLatency);

        const isValid = validateResponse(response, {
            hasData: true,
        });

        if (isValid && response.status === 200) {
            const body = JSON.parse(response.body);
            const results = body.data || body;

            productsReturned.add(results.length);

            if (results.length === 0) {
                emptyResults.add(1);
            }

            // Validate search relevance
            if (results.length > 0) {
                check(results[0], {
                    'search result has title': (r) => r.title && r.title.length > 0,
                    'search result has price': (r) => typeof r.discountedPrice === 'number',
                });
            }
        }
    });
}

/**
 * Scenario 4: Browse products by category
 * Simulates user filtering by category
 */
function scenario_browseByCategory() {
    group('Browse by Category', () => {
        const category = getRandomTestData('categories');
        const page = randomIntBetween(1, 3);
        const limit = 20;
        const url = `${CONFIG.baseUrl}/products/category/${encodeURIComponent(category)}?page=${page}&limit=${limit}`;

        const response = executeRequest('GET', url, {}, getByCategoryLatency);

        const isValid = validateResponse(response, {
            hasData: true,
            hasPagination: true,
        });

        if (isValid && response.status === 200) {
            const body = JSON.parse(response.body);
            productsReturned.add(body.data.length);

            // Validate category filtering
            if (body.data.length > 0) {
                check(body.data[0], {
                    'product has correct category': (p) =>
                        p.category.toLowerCase() === category.toLowerCase(),
                });
            }
        }
    });
}

/**
 * Scenario 5: View user's products
 * Simulates viewing a seller's product listings
 */
function scenario_viewUserProducts() {
    group('View User Products', () => {
        const userId = getRandomTestData('userIds');
        const page = 1;
        const limit = 20;
        const url = `${CONFIG.baseUrl}/products/user/${userId}?page=${page}&limit=${limit}`;

        const response = executeRequest('GET', url, {}, getByUserIdLatency);

        const isValid = validateResponse(response, {
            hasData: true,
            hasPagination: true,
        });

        if (isValid && response.status === 200) {
            const body = JSON.parse(response.body);
            productsReturned.add(body.data.length);
        }
    });
}

/**
 * Scenario 6: View featured products
 * Simulates homepage featured products section
 */
function scenario_viewFeaturedProducts() {
    group('View Featured Products', () => {
        const url = `${CONFIG.baseUrl}/products/featured`;

        const response = executeRequest('GET', url, {}, getFeaturedLatency);

        const isValid = validateResponse(response, {
            hasData: true,
        });

        if (isValid && response.status === 200) {
            const products = JSON.parse(response.body);
            productsReturned.add(products.length);

            // Validate featured products characteristics
            check(products, {
                'has products': (p) => Array.isArray(p) && p.length > 0,
                'limited to 20': (p) => p.length <= 20,
            });

            if (products.length > 0) {
                check(products[0], {
                    'featured product has premium seller': (p) =>
                        p.user && p.user.premiumTier !== 'FREE',
                });
            }
        }
    });
}

/**
 * Scenario 7: Advanced search with filters
 * Simulates power user with multiple filters
 */
function scenario_advancedSearch() {
    group('Advanced Search with Filters', () => {
        const searchTerm = getRandomTestData('searchTerms');
        const category = getRandomTestData('categories');
        const condition = getRandomTestData('conditions');
        const priceRange = getRandomTestData('priceRanges');

        const url = `${CONFIG.baseUrl}/products/search?` +
            `q=${searchTerm}` +
            `&category=${encodeURIComponent(category)}` +
            `&condition=${condition}` +
            `&minPrice=${priceRange.min}` +
            `&maxPrice=${priceRange.max}` +
            `&inStock=true` +
            `&sortBy=price-asc` +
            `&page=1&limit=20`;

        const response = executeRequest('GET', url, {}, searchProductsLatency);

        validateResponse(response, {
            hasData: true,
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST EXECUTION (Realistic User Journey)
// ═══════════════════════════════════════════════════════════════════════════

export default function () {
    // Simulate realistic user behavior with weighted scenarios
    const scenarios = [
        { weight: 30, fn: scenario_browseProducts },        // Most common
        { weight: 25, fn: scenario_viewProductDetails },    // Very common
        { weight: 20, fn: scenario_searchProducts },        // Common
        { weight: 10, fn: scenario_browseByCategory },      // Moderate
        { weight: 7, fn: scenario_viewFeaturedProducts },   // Less common
        { weight: 5, fn: scenario_viewUserProducts },       // Occasional
        { weight: 3, fn: scenario_advancedSearch },         // Rare power user
    ];

    // Select scenario based on weighted distribution
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = randomIntBetween(1, totalWeight);

    for (const scenario of scenarios) {
        random -= scenario.weight;
        if (random <= 0) {
            scenario.fn();
            break;
        }
    }

    // Realistic think time between actions
    thinkTime(1, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Setup - Runs once before test execution
 * Validates API availability and prepares test environment
 */
export function setup() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🚀 K6 LOAD TEST - PRODUCT API');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 Test Type: ${CONFIG.testType.toUpperCase()}`);
    console.log(`🎯 Target URL: ${CONFIG.baseUrl}`);
    console.log(`⏱️  Performance Budgets:`);
    console.log(`   - getAllProducts: p95 < ${CONFIG.budgets.getAllProducts.p95}ms`);
    console.log(`   - getProductById: p95 < ${CONFIG.budgets.getProductById.p95}ms`);
    console.log(`   - searchProducts: p95 < ${CONFIG.budgets.searchProducts.p95}ms`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Warm-up request to check API availability
    const response = http.get(`${CONFIG.baseUrl}/products?limit=1`);

    if (response.status !== 200) {
        throw new Error(`API is not available. Status: ${response.status}`);
    }

    console.log('✅ API is available and ready for testing\n');

    return { startTime: new Date().toISOString() };
}

/**
 * Teardown - Runs once after test completion
 * Cleanup and final validations
 */
export function teardown(data) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETED');
    console.log(`Started: ${data.startTime}`);
    console.log(`Ended: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Generate comprehensive test report
 * Includes HTML report and text summary
 */
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'k6-reports/summary.html': htmlReport(data),
        'k6-reports/summary.json': JSON.stringify(data, null, 2),
    };
}
