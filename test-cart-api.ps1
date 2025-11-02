# Cart API Testing Script (PowerShell)
# Replace TOKEN with your actual JWT token from login

$TOKEN = "YOUR_JWT_TOKEN_HERE"
$BASE_URL = "http://localhost:3001"

Write-Host "=== Sellr Cart API Tests ===" -ForegroundColor Green
Write-Host ""

# Test 1: Get Cart
Write-Host "Test 1: Get Current Cart" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/cart" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
    }
$response | ConvertTo-Json -Depth 10
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 2: Add Item to Cart
Write-Host "Test 2: Add Item to Cart" -ForegroundColor Yellow
$body = @{
    productId = 1
    quantity = 1
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/cart" `
    -Method Post `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } `
    -Body $body
$response | ConvertTo-Json -Depth 10
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 3: Get Cart Item Count
Write-Host "Test 3: Get Cart Item Count" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/cart/count" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
    }
$response | ConvertTo-Json
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 4: Merge Cart - Basic
Write-Host "Test 4: Merge Cart - Basic (2 items)" -ForegroundColor Yellow
$body = @{
    items = @(
        @{
            productId = 1
            quantity = 2
        },
        @{
            productId = 2
            quantity = 1
        }
    )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "$BASE_URL/cart/merge" `
    -Method Post `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } `
    -Body $body
$response | ConvertTo-Json -Depth 10
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 5: Get Cart After Merge
Write-Host "Test 5: Get Cart After Merge" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/cart" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
    }
$response | ConvertTo-Json -Depth 10
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 6: Merge Same Product (should combine quantities)
Write-Host "Test 6: Merge Same Product (should combine)" -ForegroundColor Yellow
$body = @{
    items = @(
        @{
            productId = 1
            quantity = 3
        }
    )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "$BASE_URL/cart/merge" `
    -Method Post `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } `
    -Body $body
$response | ConvertTo-Json -Depth 10
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Error Tests
Write-Host "=== Error Tests ===" -ForegroundColor Red
Write-Host ""

# Test 7: Empty Items Array
Write-Host "Test 7: Merge Empty Array (should fail)" -ForegroundColor Yellow
try {
    $body = @{
        items = @()
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/cart/merge" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body $body
    $response | ConvertTo-Json
} catch {
    Write-Host "Error (Expected):" -ForegroundColor Red
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 8: Invalid Quantity (Zero)
Write-Host "Test 8: Invalid Quantity - Zero (should fail)" -ForegroundColor Yellow
try {
    $body = @{
        items = @(
            @{
                productId = 1
                quantity = 0
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/cart/merge" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body $body
    $response | ConvertTo-Json
} catch {
    Write-Host "Error (Expected):" -ForegroundColor Red
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 9: Product Not Found
Write-Host "Test 9: Non-existent Product (should fail)" -ForegroundColor Yellow
try {
    $body = @{
        items = @(
            @{
                productId = 99999
                quantity = 1
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/cart/merge" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body $body
    $response | ConvertTo-Json
} catch {
    Write-Host "Error (Expected):" -ForegroundColor Red
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 10: No Authorization
Write-Host "Test 10: No Auth Token (should fail)" -ForegroundColor Yellow
try {
    $body = @{
        items = @(
            @{
                productId = 1
                quantity = 1
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/cart/merge" `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json"
        } `
        -Body $body
    $response | ConvertTo-Json
} catch {
    Write-Host "Error (Expected):" -ForegroundColor Red
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
Write-Host "---" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Tests Complete ===" -ForegroundColor Green
