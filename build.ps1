# Build script: Package Varo for AiPASS for Chrome Web Store submission
param(
    [string]$SourceDir = (Split-Path -Parent $MyInvocation.MyCommand.Path),
    [string]$OutputDir = (Join-Path $SourceDir "dist"),
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$manifestPath = Join-Path $SourceDir "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found in $SourceDir"
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifestVersion = $manifest.version
if ($Version -eq "1.0.0" -and $manifestVersion) {
    $Version = $manifestVersion
}

Write-Host "=== VaroChrome 2.0 Build Script ===" -ForegroundColor Cyan
Write-Host "Source: $SourceDir"
Write-Host "Version: $Version"
Write-Host ""

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$exclude = @("*.ps1", "*.psd1", "*.psm1", "node_modules", ".git", ".gitignore", "dist", "*.zip", "*.crx", "*.pem", "STORE_LISTING.md", "screenshots")

$zipName = "VaroChrome-${Version}.zip"
$zipPath = Join-Path $OutputDir $zipName

Write-Host "Creating package: $zipPath" -ForegroundColor Yellow

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$itemsToZip = @()
Get-ChildItem -Path $SourceDir -Exclude $exclude | ForEach-Object {
    $itemsToZip += $_.FullName
}

Compress-Archive -Path $itemsToZip -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "OK Package created: $zipPath" -ForegroundColor Green

$zipFile = Get-Item $zipPath
$sizeKB = [math]::Round($zipFile.Length / 1KB, 1)
Write-Host "  Size: $sizeKB KB"

Write-Host ""
Write-Host "Package contents:" -ForegroundColor Cyan
$zipContent = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$zipContent.Entries | ForEach-Object {
    $lenKB = [math]::Round($_.Length / 1KB, 1)
    $line = "  " + $_.Name + " (" + $lenKB + " KB)"
    Write-Host $line
}
$zipContent.Dispose()

Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Cyan
Write-Host "Next steps:"
Write-Host "  1. Upload $zipName to Chrome Web Store Developer Dashboard"
Write-Host "  2. Prepare store listing (see STORE_LISTING.md)"
Write-Host "  3. Upload screenshots (1280x800 or 640x400)"
Write-Host "  4. Link Privacy Policy URL"
