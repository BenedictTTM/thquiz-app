# MeiliSearch Performance Test Script
# Tests search performance and validates optimization

Write-Host "🔍 MeiliSearch Performance Test Suite" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"
$searchEndpoint = "$baseUrl/product/search"

# Test 1: Basic Search Performance
Write-Host "Test 1: Basic Search Performance" -ForegroundColor Yellow
Write-Host "--------------------------------" -ForegroundColor Yellow

$testQueries = @(
    "laptop",
    "phone",
    "camera",
    "headphones",
    "watch"
)

$totalTime = 0
$testCount = 0

foreach ($query in $testQueries) {
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "$searchEndpoint?q=$query" -Method Get
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $totalTime += $duration
        $testCount++
        
        $status = if ($duration -lt 50) { "⚡ EXCELLENT" } 
                  elseif ($duration -lt 100) { "✅ GOOD" }
                  elseif ($duration -lt 200) { "⚠️  ACCEPTABLE" }
                  else { "❌ SLOW" }
        
        Write-Host "  Query: '$query' | ${duration}ms | $status" -ForegroundColor $(if ($duration -lt 100) { "Green" } else { "Yellow" })
        Write-Host "  Results: $($response.total) found"
    }
    catch {
        Write-Host "  ❌ Failed: $_" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 100
}

$avgTime = $totalTime / $testCount
Write-Host ""
Write-Host "Average Search Time: ${avgTime}ms" -ForegroundColor $(if ($avgTime -lt 100) { "Green" } else { "Yellow" })
Write-Host ""

# Test 2: Typo Tolerance
Write-Host "Test 2: Typo Tolerance" -ForegroundColor Yellow
Write-Host "----------------------" -ForegroundColor Yellow

$typoTests = @(
    @{ correct = "laptop"; typo = "laptpo" },
    @{ correct = "phone"; typo = "phoen" },
    @{ correct = "camera"; typo = "camra" }
)

foreach ($test in $typoTests) {
    try {
        $response = Invoke-RestMethod -Uri "$searchEndpoint?q=$($test.typo)" -Method Get
        $found = $response.total -gt 0
        
        if ($found) {
            Write-Host "  ✅ '$($test.typo)' -> Found results (typo corrected)" -ForegroundColor Green
        }
        else {
            Write-Host "  ❌ '$($test.typo)' -> No results" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "  ❌ Failed: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Filter Performance
Write-Host "Test 3: Filter Performance" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow

$filterTests = @(
    @{ name = "Category Filter"; param = "category=Electronics" },
    @{ name = "Price Range"; param = "minPrice=100&maxPrice=500" },
    @{ name = "Condition Filter"; param = "condition=New" },
    @{ name = "Multiple Filters"; param = "category=Electronics&condition=New&minPrice=100" }
)

foreach ($test in $filterTests) {
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "$searchEndpoint?q=&$($test.param)" -Method Get
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $status = if ($duration -lt 100) { "⚡" } else { "⚠️" }
        Write-Host "  $status $($test.name): ${duration}ms | $($response.total) results" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ $($test.name): Failed" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: Pagination Performance
Write-Host "Test 4: Pagination Performance" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

$pages = @(0, 20, 40, 60, 80)
foreach ($offset in $pages) {
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "$searchEndpoint?q=laptop&limit=20&offset=$offset" -Method Get
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        Write-Host "  Page $($offset/20 + 1) (offset $offset): ${duration}ms" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Page $($offset/20 + 1): Failed" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: Load Test (Concurrent Requests)
Write-Host "Test 5: Load Test (Concurrent Requests)" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow

Write-Host "  Sending 10 concurrent requests..." -ForegroundColor Cyan
$startTime = Get-Date

$jobs = 1..10 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($url)
        Invoke-RestMethod -Uri $url -Method Get
    } -ArgumentList "$searchEndpoint?q=laptop"
}

$jobs | Wait-Job | Out-Null
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalMilliseconds

Write-Host "  ✅ 10 concurrent requests completed in ${duration}ms" -ForegroundColor Green
Write-Host "  Average per request: $($duration/10)ms" -ForegroundColor Green

$jobs | Remove-Job

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Performance Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Recommendations:" -ForegroundColor Yellow
Write-Host "  - Search < 50ms: EXCELLENT ⚡" -ForegroundColor Green
Write-Host "  - Search 50-100ms: GOOD ✅" -ForegroundColor Green
Write-Host "  - Search 100-200ms: ACCEPTABLE ⚠️" -ForegroundColor Yellow
Write-Host "  - Search > 200ms: NEEDS OPTIMIZATION ❌" -ForegroundColor Red
Write-Host ""
