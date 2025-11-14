import http from 'k6/http';
import { check, sleep } from 'k6';

// Simple test configuration
export const options = {
    vus: 50, // 20 virtual users
    duration: '1m', // Run for 1 minute
    thresholds: {
        'http_req_duration': ['p(95)<800'], // 95% of requests should be below 800ms
        'http_req_failed': ['rate<0.03'], // Error rate should be below 3%
    },
}


const BASE_URL = 'http://localhost:3001';
export default function (){
    const response = http.get(`${BASE_URL}/products?page=1&limit=10`);

    check(response, {
        'status is 200': (r) => r.status === 200,
        'has response': (r) => r.body.length > 0,
        'response time < 1s': (r) => r.timings.duration < 1000,
    });
    sleep(1);   
}



// import http from 'k6/http';
// import { check, sleep } from 'k6';

// // Simple test configuration
// export const options = {
//     vus: 50, // 5 virtual users
//     duration: '15s', // Run for 15 seconds
//     thresholds: {
//         'http_req_duration': ['p(95)<1000'], // 95% of requests should be below 1000ms
//         'http_req_failed': ['rate<0.1'], // Error rate should be below 10%
//     },
// };

// const BASE_URL = 'http://localhost:3001';

// export default function () {
//     // Test: Get all products
//     const response = http.get(`${BASE_URL}/products?page=1&limit=5`);

//     check(response, {
//         'status is 200': (r) => r.status === 200,
//         'has response': (r) => r.body.length > 0,
//         'response time < 2s': (r) => r.timings.duration < 2000,
//     });
//     sleep(1);
// }
