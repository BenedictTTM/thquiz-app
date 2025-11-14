import http from 'k6/http';
import { check, sleep } from 'k6';

// Simple test configuration
export const options = {
    vus: 10, // 10 virtual users
    duration: '30s', // Run for 30 seconds
    thresholds: {
        'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
        'http_req_failed': ['rate<0.05'], // Error rate should be below 5%
    },
};

const BASE_URL = 'http://localhost:3001';

export default function () {
    // Test 1: Get all products
    const getAllResponse = http.get(`${BASE_URL}/products?page=1&limit=10`);
    check(getAllResponse, {
        'Get all products - status is 200': (r) => r.status === 200,
        'Get all products - has response': (r) => r.body.length > 0,
    });

    sleep(1);

    // Test 2: Get single product
    const getOneResponse = http.get(`${BASE_URL}/products/1`);
    check(getOneResponse, {
        'Get product by ID - status is 200': (r) => r.status === 200,
        'Get product by ID - has title': (r) => {
            try {
                const product = JSON.parse(r.body);
                return product.title !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    sleep(1);

    // Test 3: Search products
    const searchResponse = http.get(`${BASE_URL}/products/search?q=laptop`);
    check(searchResponse, {
        'Search products - status is 200': (r) => r.status === 200,
        'Search products - has results': (r) => r.body.length > 0,
    });

    sleep(1);
}
