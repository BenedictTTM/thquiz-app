#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Setup k6 load testing environment

.DESCRIPTION
    Automated setup script for k6 load testing suite.
    Checks prerequisites, installs k6, and validates installation.

.EXAMPLE
    .\setup-k6.ps1
    
.EXAMPLE
    .\setup-k6.ps1 -SkipValidation
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipValidation
)

$ErrorActionPreference = 'Stop'

# Colors
$InfoColor = 'Cyan'
$SuccessColor = 'Green'
$ErrorColor = 'Red'
$WarningColor = 'Yellow'

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

function Test-Chocolatey {
    try {
        $chocoVersion = choco --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Chocolatey is installed: v$chocoVersion" $SuccessColor
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Install-Chocolatey {
    Write-ColorOutput "📦 Installing Chocolatey..." $InfoColor
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-ColorOutput "✅ Chocolatey installed successfully" $SuccessColor
        return $true
    } catch {
        Write-ColorOutput "❌ Failed to install Chocolatey: $($_.Exception.Message)" $ErrorColor
        Write-ColorOutput "Please install manually from: https://chocolatey.org/install" $WarningColor
        return $false
    }
}

function Test-K6Installed {
    try {
        $version = k6 version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ k6 is installed: $version" $SuccessColor
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Install-K6 {
    Write-ColorOutput "📦 Installing k6..." $InfoColor
    
    try {
        # Try Chocolatey first
        if (Test-Chocolatey) {
            choco install k6 -y
            
            # Refresh environment
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            if (Test-K6Installed) {
                Write-ColorOutput "✅ k6 installed successfully via Chocolatey" $SuccessColor
                return $true
            }
        }
        
        # If Chocolatey install failed, try manual download
        Write-ColorOutput "⚠️  Chocolatey installation failed. Attempting manual installation..." $WarningColor
        
        $downloadUrl = "https://github.com/grafana/k6/releases/latest/download/k6-latest-windows-amd64.zip"
        $zipPath = "$env:TEMP\k6.zip"
        $extractPath = "$env:ProgramFiles\k6"
        
        Write-ColorOutput "Downloading k6..." $InfoColor
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
        
        Write-ColorOutput "Extracting k6..." $InfoColor
        Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
        
        # Add to PATH
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($currentPath -notlike "*$extractPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$extractPath", "Machine")
            $env:Path += ";$extractPath"
        }
        
        # Cleanup
        Remove-Item $zipPath -Force
        
        if (Test-K6Installed) {
            Write-ColorOutput "✅ k6 installed successfully via manual download" $SuccessColor
            return $true
        }
        
        return $false
        
    } catch {
        Write-ColorOutput "❌ Failed to install k6: $($_.Exception.Message)" $ErrorColor
        Write-ColorOutput "Please install manually from: https://k6.io/docs/get-started/installation/" $WarningColor
        return $false
    }
}

function Test-DirectoryStructure {
    Write-ColorOutput "🔍 Checking directory structure..." $InfoColor
    
    $requiredDirs = @(
        "k6-tests",
        "k6-reports"
    )
    
    $allExist = $true
    foreach ($dir in $requiredDirs) {
        if (Test-Path $dir) {
            Write-ColorOutput "  ✅ $dir exists" $SuccessColor
        } else {
            Write-ColorOutput "  ⚠️  $dir does not exist - creating..." $WarningColor
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-ColorOutput "  ✅ Created $dir" $SuccessColor
        }
    }
    
    return $true
}

function Test-RequiredFiles {
    Write-ColorOutput "🔍 Checking required test files..." $InfoColor
    
    $requiredFiles = @(
        "k6-tests\product-api-load-tests.js",
        "k6-tests\k6-config.js",
        "k6-tests\README.md"
    )
    
    $allExist = $true
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "  ✅ $file exists" $SuccessColor
        } else {
            Write-ColorOutput "  ❌ $file is missing" $ErrorColor
            $allExist = $false
        }
    }
    
    return $allExist
}

function Test-BackendRunning {
    Write-ColorOutput "🔍 Checking if backend is running..." $InfoColor
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/products?limit=1" -Method GET -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "  ✅ Backend is running and accessible" $SuccessColor
            return $true
        }
    } catch {
        Write-ColorOutput "  ⚠️  Backend is not running on http://localhost:3001" $WarningColor
        Write-ColorOutput "  💡 Start the backend before running tests" $InfoColor
        return $false
    }
}

function Run-ValidationTest {
    Write-ColorOutput "🧪 Running validation test..." $InfoColor
    
    try {
        k6 run --env TEST_TYPE=smoke --duration 10s k6-tests\product-api-load-tests.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Validation test passed!" $SuccessColor
            return $true
        } else {
            Write-ColorOutput "⚠️  Validation test completed with warnings" $WarningColor
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Validation test failed: $($_.Exception.Message)" $ErrorColor
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

Write-Banner "K6 LOAD TESTING SETUP"

Write-ColorOutput "This script will:" $InfoColor
Write-ColorOutput "  1. Check for Chocolatey package manager" $InfoColor
Write-ColorOutput "  2. Install k6 if not present" $InfoColor
Write-ColorOutput "  3. Verify directory structure" $InfoColor
Write-ColorOutput "  4. Check required files" $InfoColor
Write-ColorOutput "  5. Run validation test (optional)" $InfoColor
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-ColorOutput "⚠️  Not running as Administrator. Some operations may fail." $WarningColor
    Write-ColorOutput "💡 Consider running as Administrator for best results." $InfoColor
    Write-Host ""
}

# Step 1: Check/Install Chocolatey
Write-Banner "STEP 1: CHOCOLATEY"

if (-not (Test-Chocolatey)) {
    Write-ColorOutput "Chocolatey is not installed" $WarningColor
    $installChoco = Read-Host "Install Chocolatey? (y/N)"
    
    if ($installChoco -eq 'y' -or $installChoco -eq 'Y') {
        if (-not (Install-Chocolatey)) {
            Write-ColorOutput "⚠️  Continuing without Chocolatey..." $WarningColor
        }
    }
}

# Step 2: Check/Install k6
Write-Banner "STEP 2: K6 INSTALLATION"

if (-not (Test-K6Installed)) {
    Write-ColorOutput "k6 is not installed" $WarningColor
    
    if (-not (Install-K6)) {
        Write-ColorOutput "❌ Failed to install k6 automatically" $ErrorColor
        Write-ColorOutput "" $ErrorColor
        Write-ColorOutput "Manual Installation Options:" $InfoColor
        Write-ColorOutput "  1. Chocolatey: choco install k6" $InfoColor
        Write-ColorOutput "  2. Download: https://github.com/grafana/k6/releases" $InfoColor
        Write-ColorOutput "  3. Winget: winget install k6" $InfoColor
        exit 1
    }
}

# Step 3: Check directory structure
Write-Banner "STEP 3: DIRECTORY STRUCTURE"
Test-DirectoryStructure | Out-Null

# Step 4: Check required files
Write-Banner "STEP 4: REQUIRED FILES"
if (-not (Test-RequiredFiles)) {
    Write-ColorOutput "❌ Some required files are missing" $ErrorColor
    Write-ColorOutput "Please ensure all k6 test files are present" $WarningColor
    exit 1
}

# Step 5: Check backend
Write-Banner "STEP 5: BACKEND AVAILABILITY"
$backendRunning = Test-BackendRunning

# Step 6: Run validation test
if (-not $SkipValidation) {
    Write-Banner "STEP 6: VALIDATION TEST"
    
    if ($backendRunning) {
        Run-ValidationTest | Out-Null
    } else {
        Write-ColorOutput "⚠️  Skipping validation test (backend not running)" $WarningColor
        Write-ColorOutput "💡 Start backend and run: k6 run --env TEST_TYPE=smoke k6-tests\product-api-load-tests.js" $InfoColor
    }
}

# Summary
Write-Banner "SETUP COMPLETE"

Write-ColorOutput "✅ Setup completed successfully!" $SuccessColor
Write-Host ""
Write-ColorOutput "📚 Next Steps:" $InfoColor
Write-ColorOutput "  1. Review documentation: k6-tests\README.md" $InfoColor
Write-ColorOutput "  2. Start backend server if not running" $InfoColor
Write-ColorOutput "  3. Run your first test: k6 run --env TEST_TYPE=smoke k6-tests\product-api-load-tests.js" $InfoColor
Write-ColorOutput "  4. Or use the helper script: .\k6-tests\run-load-tests.ps1 -TestType smoke" $InfoColor
Write-Host ""
Write-ColorOutput "📖 Documentation:" $InfoColor
Write-ColorOutput "  - README: k6-tests\README.md" $InfoColor
Write-ColorOutput "  - Quick Reference: k6-tests\QUICK_REFERENCE.md" $InfoColor
Write-ColorOutput "  - Testing Guide: k6-tests\TESTING_GUIDE.md" $InfoColor
Write-Host ""
Write-ColorOutput "═══════════════════════════════════════════════════════════" $InfoColor
