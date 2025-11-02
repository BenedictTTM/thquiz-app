# Cart Merge Endpoint - Testing Guide

## Endpoint Information

**URL:** `POST /cart/merge`  
**Authentication:** Required (Bearer Token)  
**Content-Type:** `application/json`

---

## Quick Test

### 1. Setup Test Data

First, ensure you have some products in your database and a valid JWT token.

```bash
# Get your access token from login
TOKEN="your_jwt_token_here"
```

### 2. Test Merge Request

```bash
curl -X POST http://localhost:3001/cart/merge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": 1, "quantity": 2 },
      { "productId": 2, "quantity": 1 }
    ]
  }'
```

---

## Test Scenarios

### Scenario 1: Basic Merge (New Items)

**Setup:** User has empty cart  
**Action:** Merge 2 items from anonymous cart

```json
POST /cart/merge
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 5, "quantity": 1 }
  ]
}
```

**Expected Result:**

- Status: `200 OK`
- Cart created with 2 items
- Subtotal calculated correctly
- Total items: 3

---

### Scenario 2: Merge with Existing Items

**Setup:** User already has Product 1 (qty: 1) in cart  
**Action:** Merge Product 1 (qty: 2) from anonymous cart

```json
POST /cart/merge
{
  "items": [
    { "productId": 1, "quantity": 2 }
  ]
}
```

**Expected Result:**

- Status: `200 OK`
- Product 1 quantity updated to 3 (1 + 2)
- No duplicate items
- Subtotal updated

---

### Scenario 3: Mixed Merge

**Setup:** User has Product 1 (qty: 1) in cart  
**Action:** Merge Product 1 (qty: 2) and Product 5 (qty: 1)

```json
POST /cart/merge
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 5, "quantity": 1 }
  ]
}
```

**Expected Result:**

- Product 1: quantity = 3 (merged)
- Product 5: quantity = 1 (new)
- Total items: 4
- Both items in response

---

### Scenario 4: Insufficient Stock

**Setup:** Product 1 has stock = 2  
**Action:** Try to merge quantity = 3

```json
POST /cart/merge
{
  "items": [
    { "productId": 1, "quantity": 3 }
  ]
}
```

**Expected Result:**

- Status: `400 Bad Request`
- Error message about insufficient stock
- Cart remains unchanged

---

### Scenario 5: Product Not Found

**Action:** Merge non-existent product

```json
POST /cart/merge
{
  "items": [
    { "productId": 99999, "quantity": 1 }
  ]
}
```

**Expected Result:**

- Status: `404 Not Found`
- Error message: "Products not found: 99999"
- Cart remains unchanged

---

### Scenario 6: Invalid Data

**Action:** Send invalid quantity

```json
POST /cart/merge
{
  "items": [
    { "productId": 1, "quantity": 0 }
  ]
}
```

**Expected Result:**

- Status: `400 Bad Request`
- Validation error: "Quantity must be at least 1"

---

### Scenario 7: Empty Items Array

**Action:** Send empty array

```json
POST /cart/merge
{
  "items": []
}
```

**Expected Result:**

- Status: `400 Bad Request`
- Validation error: "At least one item is required to merge"

---

## Postman Collection

### Request Setup

1. **Method:** POST
2. **URL:** `{{baseUrl}}/cart/merge`
3. **Headers:**
   ```
   Authorization: Bearer {{accessToken}}
   Content-Type: application/json
   ```
4. **Body (raw JSON):**
   ```json
   {
     "items": [
       { "productId": 1, "quantity": 2 },
       { "productId": 5, "quantity": 1 }
     ]
   }
   ```

### Environment Variables

```
baseUrl = http://localhost:3001
accessToken = <your_jwt_token>
```

---

## Response Examples

### Success Response

```json
{
  "id": 1,
  "userId": 42,
  "items": [
    {
      "id": 1,
      "quantity": 3,
      "product": {
        "id": 1,
        "title": "iPhone 15 Pro",
        "description": "Latest iPhone model",
        "originalPrice": 999.99,
        "discountedPrice": 899.99,
        "imageUrl": ["https://..."],
        "stock": 10,
        "condition": "New",
        "category": "Electronics"
      },
      "itemTotal": 2699.97
    },
    {
      "id": 2,
      "quantity": 1,
      "product": {
        "id": 5,
        "title": "AirPods Pro",
        "description": "Wireless earbuds",
        "originalPrice": 249.99,
        "discountedPrice": null,
        "imageUrl": ["https://..."],
        "stock": 25,
        "condition": "New",
        "category": "Electronics"
      },
      "itemTotal": 249.99
    }
  ],
  "subtotal": 2949.96,
  "totalItems": 4,
  "createdAt": "2025-11-02T10:00:00.000Z",
  "updatedAt": "2025-11-02T10:35:00.000Z"
}
```

### Error Response - Insufficient Stock

```json
{
  "statusCode": 400,
  "message": "Insufficient stock for \"iPhone 15 Pro\". You already have 1 in cart, trying to add 10 more, but only 5 available in total.",
  "error": "Bad Request"
}
```

### Error Response - Product Not Found

```json
{
  "statusCode": 404,
  "message": "Products not found: 999, 1000",
  "error": "Not Found"
}
```

### Error Response - Validation

```json
{
  "statusCode": 400,
  "message": ["Quantity must be at least 1", "Product ID must be positive"],
  "error": "Bad Request"
}
```

---

## Testing Workflow

### Complete Integration Test

1. **Clear existing cart**

   ```bash
   curl -X DELETE http://localhost:3001/cart \
     -H "Authorization: Bearer $TOKEN"
   ```

2. **Verify cart is empty**

   ```bash
   curl -X GET http://localhost:3001/cart \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Add item to cart (simulate existing cart)**

   ```bash
   curl -X POST http://localhost:3001/cart \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "productId": 1, "quantity": 1 }'
   ```

4. **Verify cart has 1 item**

   ```bash
   curl -X GET http://localhost:3001/cart \
     -H "Authorization: Bearer $TOKEN"
   ```

5. **Merge anonymous cart (2 items, one duplicate)**

   ```bash
   curl -X POST http://localhost:3001/cart/merge \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "items": [
         { "productId": 1, "quantity": 2 },
         { "productId": 5, "quantity": 1 }
       ]
     }'
   ```

6. **Verify merge result**
   - Product 1 should have quantity 3 (1 + 2)
   - Product 5 should have quantity 1
   - Total items should be 4
   - Subtotal should be correct

---

## Common Issues & Solutions

### Issue 1: 401 Unauthorized

**Cause:** Missing or invalid JWT token  
**Solution:**

- Login to get fresh token
- Check token format in Authorization header
- Verify token hasn't expired

### Issue 2: 404 Product Not Found

**Cause:** Product IDs don't exist in database  
**Solution:**

- Check product IDs in database
- Use valid product IDs from `/products` endpoint

### Issue 3: Stock Validation Fails

**Cause:** Requesting more items than available  
**Solution:**

- Check product stock in database
- Reduce quantity in merge request

### Issue 4: Validation Errors

**Cause:** Invalid request body format  
**Solution:**

- Ensure `items` is an array
- Each item must have `productId` and `quantity`
- All values must be positive integers

---

## Database Verification

After successful merge, verify in database:

```sql
-- Check cart
SELECT * FROM "Cart" WHERE "userId" = YOUR_USER_ID;

-- Check cart items
SELECT ci.*, p.title, p.stock
FROM "CartItem" ci
JOIN "Product" p ON ci."productId" = p.id
WHERE ci."cartId" = YOUR_CART_ID;

-- Verify no duplicate products
SELECT "productId", COUNT(*)
FROM "CartItem"
WHERE "cartId" = YOUR_CART_ID
GROUP BY "productId"
HAVING COUNT(*) > 1;  -- Should return 0 rows
```

---

## Performance Notes

- **Transaction Safety:** All operations use database transaction
- **Atomicity:** Either all items merge successfully or none do
- **Validation:** Products and stock validated before any changes
- **Logging:** Detailed logs for debugging (check server console)

---

## Next Steps

1. ✅ Endpoint implemented
2. ✅ Validation added
3. ✅ Error handling complete
4. ⏳ Test with frontend integration
5. ⏳ Monitor production logs
6. ⏳ Add analytics for merge operations

---

**Last Updated:** November 2, 2025  
**Version:** 1.0.0  
**Status:** ✅ Ready for Testing
