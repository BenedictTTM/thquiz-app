import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  // Stress test configuration - gradually increase load (within 100 VU limit)
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 40 },   // Ramp up to 40 users
    { duration: '2m', target: 60 },   // Ramp up to 60 users
    { duration: '3m', target: 80 },   // Stress level - 80 users
    { duration: '2m', target: 100 },  // Peak stress - 100 users (max limit)
    { duration: '3m', target: 50 },   // Scale down
    { duration: '2m', target: 0 },    // Ramp down
  ],
  cloud: {
    projectID: 5544359,
    name: "Sellr Product API Stress Test",
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<3000'], // Allow higher latency under stress
    'http_req_failed': ['rate<0.05'], // Max 5% error rate
    'checks': ['rate>0.90'], // At least 90% of checks should pass
  },
};

const BASE_URL = 'https://sellr-backend-1.onrender.com';

// Test data for realistic scenarios
const productIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const searchTerms = ['laptop', 'phone', 'shirt', 'watch', 'techno', 'iphone', 'gucci'];
const categories = ['Electronics', 'Fashion', 'Accessories'];

export default function () {
  const scenario = Math.floor(Math.random() * 5);

  switch (scenario) {
    case 0:
      // Scenario 1: Browse all products (most common)
      testBrowseProducts();
      break;
    case 1:
      // Scenario 2: View product details
      testProductDetails();
      break;
    case 2:
      // Scenario 3: Search products
      testSearchProducts();
      break;
    case 3:
      // Scenario 4: Browse by category
      testBrowseByCategory();
      break;
    case 4:
      // Scenario 5: Mixed user journey
      testUserJourney();
      break;
  }
}

function testBrowseProducts() {
  const page = Math.floor(Math.random() * 3) + 1;
  let res = http.get(`${BASE_URL}/products?page=${page}&limit=10`);
  check(res, {
    'browse: status is 200': (r) => r.status === 200,
    'browse: has response': (r) => r.body.length > 0,
    'browse: response time < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}

function testProductDetails() {
  const productId = productIds[Math.floor(Math.random() * productIds.length)];
  let res = http.get(`${BASE_URL}/products/${productId}`);
  check(res, {
    'details: status is 200': (r) => r.status === 200,
    'details: has product data': (r) => r.body.includes('title'),
    'details: response time < 1s': (r) => r.timings.duration < 1000,
  });
  sleep(1);
}

function testSearchProducts() {
  const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  let res = http.get(`${BASE_URL}/products/search?q=${searchTerm}`);
  check(res, {
    'search: status is 200': (r) => r.status === 200,
    'search: has results': (r) => r.body.includes('products'),
    'search: response time < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}

function testBrowseByCategory() {
  const category = categories[Math.floor(Math.random() * categories.length)];
  let res = http.get(`${BASE_URL}/products/category/${encodeURIComponent(category)}`);
  check(res, {
    'category: status is 200': (r) => r.status === 200,
    'category: response time < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}

function testUserJourney() {
  // Realistic user journey: browse -> search -> view product

  // Step 1: Browse products
  let res = http.get(`${BASE_URL}/products?page=1&limit=10`);
  check(res, {
    'journey step 1: browse success': (r) => r.status === 200,
  });
  sleep(2);

  // Step 2: Search for something
  const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  res = http.get(`${BASE_URL}/products/search?q=${searchTerm}`);
  check(res, {
    'journey step 2: search success': (r) => r.status === 200,
  });
  sleep(2);

  // Step 3: View product details
  const productId = productIds[Math.floor(Math.random() * productIds.length)];
  res = http.get(`${BASE_URL}/products/${productId}`);
  check(res, {
    'journey step 3: product view success': (r) => r.status === 200,
  });
  sleep(1);
}
