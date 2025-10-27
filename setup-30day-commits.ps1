# Setup 30-Day Gradual Commit Plan
# This script creates a logical development timeline over 30 days

$ProjectPath = $PSScriptRoot
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup 30-Day Gradual Commit Plan" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get all files (excluding node_modules, dist, .git, etc.)
Write-Host "Scanning project files..." -ForegroundColor Yellow

$excludePatterns = @(
    "node_modules",
    "dist",
    ".git",
    ".daily-push-progress.txt",
    ".file-distribution-plan.txt",
    "daily-commits-log.md",
    "\.log$",
    "\.DS_Store$",
    "Thumbs\.db$"
)

# Get all files
$allFiles = Get-ChildItem -Recurse -File | Where-Object {
    $file = $_
    $relativePath = $file.FullName.Replace($ProjectPath + "\", "").Replace("\", "/")
    $shouldExclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -match $pattern) {
            $shouldExclude = $true
            break
        }
    }
    return -not $shouldExclude
} | ForEach-Object {
    $_.FullName.Replace($ProjectPath + "\", "").Replace("\", "/")
}

$totalFiles = $allFiles.Count
Write-Host "Total files to commit: $totalFiles" -ForegroundColor Green
Write-Host ""

# Organize files by category
$fileCategories = @{
    "config" = @()
    "database" = @()
    "core" = @()
    "auth" = @()
    "products" = @()
    "sales" = @()
    "purchases" = @()
    "customers" = @()
    "suppliers" = @()
    "inventory" = @()
    "reports" = @()
    "users" = @()
    "assets" = @()
    "expenses" = @()
    "delivery" = @()
    "settlements" = @()
    "utils" = @()
    "styles" = @()
    "assets_files" = @()
    "tests" = @()
    "docs" = @()
    "migrations" = @()
    "other" = @()
}

foreach ($file in $allFiles) {
    $category = "other"
    
    if ($file -match "package\.json|\.gitignore|jest\.config|build-installer") {
        $category = "config"
    }
    elseif ($file -match "database|schema|erd|migrations") {
        $category = "database"
    }
    elseif ($file -match "main\.js|preload\.js|index\.html") {
        $category = "core"
    }
    elseif ($file -match "login|password-utils") {
        $category = "auth"
    }
    elseif ($file -match "products") {
        $category = "products"
    }
    elseif ($file -match "sales") {
        $category = "sales"
    }
    elseif ($file -match "purchases") {
        $category = "purchases"
    }
    elseif ($file -match "customers") {
        $category = "customers"
    }
    elseif ($file -match "suppliers") {
        $category = "suppliers"
    }
    elseif ($file -match "inventory") {
        $category = "inventory"
    }
    elseif ($file -match "reports") {
        $category = "reports"
    }
    elseif ($file -match "users|permissions|action-logs") {
        $category = "users"
    }
    elseif ($file -match "assets\.(html|js)$") {
        $category = "assets"
    }
    elseif ($file -match "expenses") {
        $category = "expenses"
    }
    elseif ($file -match "delivery-notes") {
        $category = "delivery"
    }
    elseif ($file -match "settlements") {
        $category = "settlements"
    }
    elseif ($file -match "utils|convert-|create-icon") {
        $category = "utils"
    }
    elseif ($file -match "styles/") {
        $category = "styles"
    }
    elseif ($file -match "^assets/") {
        $category = "assets_files"
    }
    elseif ($file -match "tests/") {
        $category = "tests"
    }
    elseif ($file -match "\.md$|README") {
        $category = "docs"
    }
    elseif ($file -match "migrations/") {
        $category = "migrations"
    }
    
    $fileCategories[$category] += $file
}

# Create 30-day plan with logical development order
$plan = @()

# Day 1: Project initialization
$plan += @{
    Day = 1
    Title = "Initialize project structure and configuration"
    Files = $fileCategories["config"]
    Message = "chore: initialize project with package.json and configuration files"
}

# Day 2: Database schema and migrations
$plan += @{
    Day = 2
    Title = "Add database schema and migration system"
    Files = $fileCategories["database"] + $fileCategories["migrations"]
    Message = "feat: add database schema and migration system"
}

# Day 3: Core Electron setup
$plan += @{
    Day = 3
    Title = "Setup Electron main process and preload"
    Files = $fileCategories["core"]
    Message = "feat: setup Electron main process and IPC bridge"
}

# Day 4: Authentication system
$plan += @{
    Day = 4
    Title = "Implement authentication and login system"
    Files = $fileCategories["auth"]
    Message = "feat: implement user authentication and login system"
}

# Day 5: Main dashboard
$plan += @{
    Day = 5
    Title = "Create main dashboard page"
    Files = @("scripts/dashboard.js", "scripts/sidebar.js", "scripts/header.js", "scripts/toast.js") | Where-Object { $fileCategories["other"] -contains $_ -or $allFiles -contains $_ }
    Message = "feat: add main dashboard with sidebar and header navigation"
}

# Day 6-7: Product management
$plan += @{
    Day = 6
    Title = "Implement product management - HTML and styles"
    Files = ($fileCategories["products"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add product management UI"
}
$plan += @{
    Day = 7
    Title = "Implement product management - JavaScript logic"
    Files = ($fileCategories["products"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement product management functionality"
}

# Day 8-10: Sales management
$plan += @{
    Day = 8
    Title = "Implement sales management - HTML and styles"
    Files = ($fileCategories["sales"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add sales management UI"
}
$plan += @{
    Day = 9
    Title = "Implement sales management - JavaScript logic"
    Files = ($fileCategories["sales"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement sales invoice creation and management"
}
$plan += @{
    Day = 10
    Title = "Add PDF generation for sales invoices"
    Files = ($fileCategories["utils"] | Where-Object { $_ -match "convert.*pdf|convert-to-pdf" })
    Message = "feat: add PDF generation for sales invoices"
}

# Day 11-12: Purchase management
$plan += @{
    Day = 11
    Title = "Implement purchase management - HTML and styles"
    Files = ($fileCategories["purchases"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add purchase management UI"
}
$plan += @{
    Day = 12
    Title = "Implement purchase management - JavaScript logic"
    Files = ($fileCategories["purchases"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement purchase invoice creation and management"
}

# Day 13-14: Customer management
$plan += @{
    Day = 13
    Title = "Implement customer management - UI"
    Files = ($fileCategories["customers"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add customer management UI"
}
$plan += @{
    Day = 14
    Title = "Implement customer management - functionality"
    Files = ($fileCategories["customers"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement customer management and balance tracking"
}

# Day 15-16: Supplier management
$plan += @{
    Day = 15
    Title = "Implement supplier management - UI"
    Files = ($fileCategories["suppliers"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add supplier management UI"
}
$plan += @{
    Day = 16
    Title = "Implement supplier management - functionality"
    Files = ($fileCategories["suppliers"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement supplier management and balance tracking"
}

# Day 17-18: Inventory management
$plan += @{
    Day = 17
    Title = "Implement inventory management - UI"
    Files = ($fileCategories["inventory"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add inventory management UI"
}
$plan += @{
    Day = 18
    Title = "Implement inventory management - functionality"
    Files = ($fileCategories["inventory"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement inventory adjustments and tracking"
}

# Day 19-20: Reports
$plan += @{
    Day = 19
    Title = "Implement reports - UI"
    Files = ($fileCategories["reports"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add reports UI"
}
$plan += @{
    Day = 20
    Title = "Implement reports - functionality"
    Files = ($fileCategories["reports"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement financial and inventory reports"
}

# Day 21-22: User management and permissions
$plan += @{
    Day = 21
    Title = "Implement user management - UI"
    Files = ($fileCategories["users"] | Where-Object { $_ -match "\.html$|\.css$" })
    Message = "feat: add user management and permissions UI"
}
$plan += @{
    Day = 22
    Title = "Implement user management - functionality"
    Files = ($fileCategories["users"] | Where-Object { $_ -match "\.js$" })
    Message = "feat: implement user management, permissions, and action logs"
}

# Day 23-24: Assets and expenses
$plan += @{
    Day = 23
    Title = "Implement fixed assets and expenses management"
    Files = $fileCategories["assets"] + $fileCategories["expenses"]
    Message = "feat: add fixed assets and expense management"
}

# Day 24: Receipts and payments
$receiptsPayments = $allFiles | Where-Object { $_ -match "receipts|payments" }
$plan += @{
    Day = 24
    Title = "Implement receipts and payments"
    Files = $receiptsPayments
    Message = "feat: implement customer receipts and supplier payments"
}

# Day 25-26: Delivery notes and settlements
$plan += @{
    Day = 25
    Title = "Implement delivery notes"
    Files = $fileCategories["delivery"]
    Message = "feat: add delivery notes management"
}
$plan += @{
    Day = 26
    Title = "Implement settlements"
    Files = $fileCategories["settlements"]
    Message = "feat: add settlement management system"
}

# Day 27: Additional features
$additionalFeatures = $allFiles | Where-Object { $_ -match "backup|settings|calculator|marketing|about" }
$plan += @{
    Day = 27
    Title = "Add backup, settings, and utility features"
    Files = $additionalFeatures
    Message = "feat: add backup, settings, and utility features"
}

# Day 28: Styling and assets
$plan += @{
    Day = 28
    Title = "Add styling and asset files"
    Files = $fileCategories["styles"] + $fileCategories["assets_files"]
    Message = "style: add comprehensive styling and asset files"
}

# Day 29: Tests
$plan += @{
    Day = 29
    Title = "Add unit and integration tests"
    Files = $fileCategories["tests"]
    Message = "test: add unit and integration tests"
}

# Day 30: Documentation
$plan += @{
    Day = 30
    Title = "Add project documentation"
    Files = $fileCategories["docs"]
    Message = "docs: add comprehensive project documentation"
}

# Fill remaining files into appropriate days
$remainingFiles = @()
foreach ($category in $fileCategories.Keys) {
    foreach ($file in $fileCategories[$category]) {
        $found = $false
        foreach ($dayPlan in $plan) {
            if ($dayPlan.Files -contains $file) {
                $found = $true
                break
            }
        }
        if (-not $found) {
            $remainingFiles += $file
        }
    }
}

# Distribute remaining files across days 5-27
$remainingIndex = 0
for ($day = 5; $day -le 27; $day++) {
    if ($remainingIndex -lt $remainingFiles.Count) {
        $filesToAdd = $remainingFiles[$remainingIndex..([Math]::Min($remainingIndex + 2, $remainingFiles.Count - 1))]
        $plan[$day - 1].Files += $filesToAdd
        $remainingIndex += $filesToAdd.Count
    }
}

# Save plan to file
$planFile = ".30day-commit-plan.json"
$plan | ConvertTo-Json -Depth 10 | Set-Content -Path $planFile -Encoding UTF8

Write-Host "30-day commit plan created!" -ForegroundColor Green
Write-Host "Plan saved to: $planFile" -ForegroundColor Cyan
Write-Host ""

# Display summary
Write-Host "Plan Summary:" -ForegroundColor Cyan
foreach ($dayPlan in $plan) {
    Write-Host "  Day $($dayPlan.Day): $($dayPlan.Title) - $($dayPlan.Files.Count) files" -ForegroundColor White
}

Write-Host ""
Write-Host "Next step: Run 'execute-30day-commits.ps1' to start making commits" -ForegroundColor Yellow

