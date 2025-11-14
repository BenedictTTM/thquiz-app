#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Run k6 load tests for Product API

.DESCRIPTION
    Comprehensive PowerShell script to run k6 load tests with various configurations.
    Includes pre-flight checks, test execution, and result analysis.

.PARAMETER TestType
    Type of test to run: smoke, load, stress, spike, soak, breakpoint

.PARAMETER BaseUrl
    Base URL of the API to test (default: http://localhost:3001)

.PARAMETER OutputFormat
    Output format: console, json, influxdb, cloud

.PARAMETER SkipChecks
    Skip pre-flight checks (not recommended)

.EXAMPLE
    .\run-load-tests.ps1 -TestType smoke
    
.EXAMPLE
    .\run-load-tests.ps1 -TestType load -BaseUrl https://staging.api.sellr.com

.EXAMPLE
    .\run-load-tests.ps1 -TestType stress -OutputFormat json
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('smoke', 'load', 'stress', 'spike', 'soak', 'breakpoint')]
    [string]$TestType = 'smoke',
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = 'http://localhost:3001',
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('console', 'json', 'influxdb', 'cloud')]
    [string]$OutputFormat = 'console',
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipChecks
)

# Colors for output
$ErrorColor = 'Red'
$SuccessColor = 'Green'
$WarningColor = 'Yellow'
$InfoColor = 'Cyan'

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'White'
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Banner {
    param([string]$Title)
    Write-Host ""
    Write-ColorOutput "═══════════════════════════════════════════════════════════" $InfoColor
    Write-ColorOutput "  $Title" $InfoColor
    Write-ColorOutput "═══════════════════════════════════════════════════════════" $InfoColor
    Write-Host ""
}

function Test-K6Installed {
    try {
        $version = k6 version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ k6 is installed: $version" $SuccessColor
            return $true
        }
    } catch {
        Write-ColorOutput "❌ k6 is not installed" $ErrorColor
        Write-ColorOutput "Install k6 from: https://k6.io/docs/get-started/installation/" $WarningColor
        Write-ColorOutput "  - Windows: choco install k6" $InfoColor
        Write-ColorOutput "  - Or download from: https://github.com/grafana/k6/releases" $InfoColor
        return $false
    }
}

function Test-ApiAvailable {
    param([string]$Url)
    
    Write-ColorOutput "🔍 Checking API availability at $Url..." $InfoColor
    
    try {
        $response = Invoke-WebRequest -Uri "$Url/products?limit=1" -Method GET -TimeoutSec 10 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✅ API is available and responding" $SuccessColor
            return $true
        } else {
            Write-ColorOutput "⚠️  API responded with status: $($response.StatusCode)" $WarningColor
            return $false
        }
    } catch {
        Write-ColorOutput "❌ API is not available: $($_.Exception.Message)" $ErrorColor
        Write-ColorOutput "Ensure the backend server is running on $Url" $WarningColor
        return $false
    }
}

function Get-TestDuration {
    param([string]$Type)
    
    $durations = @{
        'smoke' = '1 minute'
        'load' = '16 minutes'
        'stress' = '15 minutes'
        'spike' = '10.5 minutes'
        'soak' = '2 hours'
        'breakpoint' = '12 minutes'
    }
    
    return $durations[$Type]
}

function Get-TestDescription {
    param([string]$Type)
    
    $descriptions = @{
        'smoke' = 'Quick validation with 1 VU'
        'load' = 'Normal production traffic (0→100 VUs)'
        'stress' = 'Beyond capacity (0→400 VUs)'
        'spike' = 'Sudden traffic bursts (20→400 VUs)'
        'soak' = 'Long-duration stability (50 VUs for 2h)'
        'breakpoint' = 'Find maximum capacity (variable RPS)'
    }
    
    return $descriptions[$Type]
}

function New-ReportsDirectory {
    $reportsDir = "k6-reports"
    
    if (-not (Test-Path $reportsDir)) {
        New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
        Write-ColorOutput "📁 Created reports directory: $reportsDir" $InfoColor
    }
    
    return $reportsDir
}

function Get-OutputCommand {
    param(
        [string]$Format,
        [string]$ReportsDir
    )
    
    switch ($Format) {
        'json' {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            return "--out json=$ReportsDir/results_$timestamp.json"
        }
        'influxdb' {
            Write-ColorOutput "⚠️  InfluxDB output requires running InfluxDB instance" $WarningColor
            return "--out influxdb=http://localhost:8086/k6"
        }
        'cloud' {
            Write-ColorOutput "⚠️  Cloud output requires k6 Cloud account" $WarningColor
            return "--out cloud"
        }
        default {
            return ""
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

Write-Banner "K6 LOAD TEST RUNNER"

# Display test information
Write-ColorOutput "📊 Test Configuration:" $InfoColor
Write-ColorOutput "   Type: $TestType" $InfoColor
Write-ColorOutput "   Description: $(Get-TestDescription $TestType)" $InfoColor
Write-ColorOutput "   Duration: $(Get-TestDuration $TestType)" $InfoColor
Write-ColorOutput "   Target URL: $BaseUrl" $InfoColor
Write-ColorOutput "   Output Format: $OutputFormat" $InfoColor
Write-Host ""

# Pre-flight checks
if (-not $SkipChecks) {
    Write-Banner "PRE-FLIGHT CHECKS"
    
    # Check if k6 is installed
    if (-not (Test-K6Installed)) {
        exit 1
    }
    
    # Check if API is available
    if (-not (Test-ApiAvailable -Url $BaseUrl)) {
        Write-ColorOutput "" $ErrorColor
        Write-ColorOutput "❌ Pre-flight checks failed. Fix the issues above and try again." $ErrorColor
        Write-ColorOutput "   Or use -SkipChecks to bypass these checks (not recommended)" $WarningColor
        exit 1
    }
    
    Write-ColorOutput "✅ All pre-flight checks passed!" $SuccessColor
    Write-Host ""
} else {
    Write-ColorOutput "⚠️  Skipping pre-flight checks as requested" $WarningColor
    Write-Host ""
}

# Create reports directory
$reportsDir = New-ReportsDirectory

# Build k6 command
$k6Command = "k6 run"
$k6Command += " --env TEST_TYPE=$TestType"
$k6Command += " --env BASE_URL=$BaseUrl"

# Add output format if specified
$outputCmd = Get-OutputCommand -Format $OutputFormat -ReportsDir $reportsDir
if ($outputCmd) {
    $k6Command += " $outputCmd"
}

# Add test file
$testFile = "k6-tests\product-api-load-tests.js"
$k6Command += " $testFile"

# Display command
Write-Banner "EXECUTING TEST"
Write-ColorOutput "Command:" $InfoColor
Write-ColorOutput "  $k6Command" $InfoColor
Write-Host ""

# Confirm before long tests
if ($TestType -in @('soak', 'breakpoint', 'stress') -and -not $SkipChecks) {
    Write-ColorOutput "⚠️  This is a long-running test ($(Get-TestDuration $TestType))" $WarningColor
    $confirm = Read-Host "Continue? (y/N)"
    
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-ColorOutput "Test cancelled by user" $WarningColor
        exit 0
    }
    Write-Host ""
}

# Record start time
$startTime = Get-Date

# Run the test
Write-ColorOutput "🚀 Starting test at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" $SuccessColor
Write-Host ""

# Execute k6
Invoke-Expression $k6Command

# Record end time
$endTime = Get-Date
$duration = $endTime - $startTime

# Display results
Write-Host ""
Write-Banner "TEST COMPLETED"

Write-ColorOutput "⏱️  Test Duration: $($duration.ToString('hh\:mm\:ss'))" $InfoColor
Write-ColorOutput "📅 Started: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))" $InfoColor
Write-ColorOutput "📅 Ended: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))" $InfoColor

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Test completed successfully!" $SuccessColor
} else {
    Write-ColorOutput "❌ Test failed with exit code: $LASTEXITCODE" $ErrorColor
}

# Check if reports were generated
if ($OutputFormat -eq 'json') {
    $reportFiles = Get-ChildItem -Path $reportsDir -Filter "results_*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($reportFiles) {
        Write-Host ""
        Write-ColorOutput "📊 Reports generated:" $InfoColor
        Write-ColorOutput "   JSON: $($reportFiles.FullName)" $InfoColor
        Write-Host ""
        Write-ColorOutput "💡 Generate HTML report with:" $InfoColor
        Write-ColorOutput "   k6-reporter $($reportFiles.FullName) --output $reportsDir/report.html" $InfoColor
    }
}

Write-Host ""
Write-ColorOutput "═══════════════════════════════════════════════════════════" $InfoColor

exit $LASTEXITCODE
