#!/bin/bash

# Cart API Testing Script
# Replace TOKEN with your actual JWT token from login

TOKEN="YOUR_JWT_TOKEN_HERE"
BASE_URL="http://localhost:3001"

echo "=== Sellr Cart API Tests ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Get Cart (should be empty or existing)
echo -e "${YELLOW}Test 1: Get Current Cart${NC}"
curl -s -X GET "$BASE_URL/cart" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""
echo "---"
echo ""

# Test 2: Add Item to Cart
echo -e "${YELLOW}Test 2: Add Item to Cart${NC}"
curl -s -X POST "$BASE_URL/cart" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "quantity": 1
  }' | jq '.'
echo ""
echo "---"
echo ""

# Test 3: Get Cart Item Count
echo -e "${YELLOW}Test 3: Get Cart Item Count${NC}"
curl -s -X GET "$BASE_URL/cart/count" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""
echo "---"
echo ""

# Test 4: Merge Cart - Basic (2 items)
echo -e "${YELLOW}Test 4: Merge Cart - Basic${NC}"
curl -s -X POST "$BASE_URL/cart/merge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 1,
        "quantity": 2
      },
      {
        "productId": 2,
        "quantity": 1
      }
    ]
  }' | jq '.'
echo ""
echo "---"
echo ""

# Test 5: Get Updated Cart
echo -e "${YELLOW}Test 5: Get Cart After Merge${NC}"
curl -s -X GET "$BASE_URL/cart" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""
echo "---"
echo ""

# Test 6: Merge with Existing Item (should combine quantities)
echo -e "${YELLOW}Test 6: Merge Same Product (should combine)${NC}"
curl -s -X POST "$BASE_URL/cart/merge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 1,
        "quantity": 3
      }
    ]
  }' | jq '.'
echo ""
echo "---"
echo ""

# Error Tests
echo -e "${RED}=== Error Tests ===${NC}"
echo ""

# Test 7: Empty Items Array
echo -e "${YELLOW}Test 7: Merge Empty Array (should fail)${NC}"
curl -s -X POST "$BASE_URL/cart/merge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": []
  }' | jq '.'
echo ""
echo "---"
echo ""

# Test 8: Invalid Quantity
echo -e "${YELLOW}Test 8: Invalid Quantity - Zero (should fail)${NC}"
curl -s -X POST "$BASE_URL/cart/merge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 1,
        "quantity": 0
      }
    ]
  }' | jq '.'
echo ""
echo "---"
echo ""

# Test 9: Product Not Found
echo -e "${YELLOW}Test 9: Non-existent Product (should fail)${NC}"
curl -s -X POST "$BASE_URL/cart/merge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 99999,
        "quantity": 1
      }
    ]
  }' | jq '.'
echo ""
echo "---"
echo ""

# Test 10: No Authorization
echo -e "${YELLOW}Test 10: No Auth Token (should fail)${NC}"
curl -s -X POST "$BASE_URL/cart/merge" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 1,
        "quantity": 1
      }
    ]
  }' | jq '.'
echo ""
echo "---"
echo ""

echo -e "${GREEN}=== Tests Complete ===${NC}"
