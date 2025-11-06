# Category API Test Script
# Tests both category endpoints

Write-Host "🧪 Testing Category API Endpoints" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001"

# Test 1: Get All Categories
Write-Host "📋 Test 1: Get All Categories" -ForegroundColor Yellow
Write-Host "GET $baseUrl/products/categories" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/products/categories" -Method Get -ContentType "application/json"
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
    Write-Host ""
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
}

Start-Sleep -Seconds 1

# Test 2: Get Products by Category (Clothes)
Write-Host "👔 Test 2: Get Products - Clothes Category" -ForegroundColor Yellow
Write-Host "GET $baseUrl/products/categories/clothes" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/products/categories/clothes" -Method Get -ContentType "application/json"
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Total Products: $($response.meta.total)" -ForegroundColor Cyan
    Write-Host "Current Page: $($response.meta.currentPage)" -ForegroundColor Cyan
    Write-Host "Products returned: $($response.data.Count)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
}

Start-Sleep -Seconds 1

# Test 3: Get Products by Category with Pagination
Write-Host "📄 Test 3: Get Products - Accessories with Pagination" -ForegroundColor Yellow
Write-Host "GET $baseUrl/products/categories/accessories?page=1&limit=10" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/products/categories/accessories?page=1&limit=10" -Method Get -ContentType "application/json"
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Total Products: $($response.meta.total)" -ForegroundColor Cyan
    Write-Host "Current Page: $($response.meta.currentPage)" -ForegroundColor Cyan
    Write-Host "Total Pages: $($response.meta.totalPages)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
}

Start-Sleep -Seconds 1

# Test 4: Get Products with Filters
Write-Host "🔍 Test 4: Get Products - Home Category with Price Filter" -ForegroundColor Yellow
Write-Host "GET $baseUrl/products/categories/home?minPrice=10&maxPrice=100&sortBy=price-asc" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/products/categories/home?minPrice=10&maxPrice=100&sortBy=price-asc" -Method Get -ContentType "application/json"
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Filtered Products: $($response.data.Count)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
}

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✨ Category API Tests Complete!" -ForegroundColor Green
