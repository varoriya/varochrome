# Generate Varo for AiPASS brand icons from the SVG source
# Requires: Inkscape or ImageMagick (or any SVG-to-PNG converter)
#
# Usage: .\generate-icons.ps1
# If you don't have a converter, the script will create high-res PNGs
# using the SVG as source. Manual conversion is also fine.
#
# For Chrome Web Store you need:
#   - icon16.png  (toolbar/favicon)
#   - icon32.png  (Windows taskbar)
#   - icon48.png  (extensions management)
#   - icon128.png (store listing + main icon)
#   - varoicon128.png (in-page Varo icon, same as icon128)

param(
    [string]$SvgPath = (Join-Path $PSScriptRoot "icons\varo-logo.svg"),
    [string]$OutputDir = (Join-Path $PSScriptRoot "icons")
)

$ErrorActionPreference = "Stop"

Write-Host "=== Varo for AiPASS Icon Generator ===" -ForegroundColor Cyan
Write-Host "SVG source: $SvgPath"
Write-Host "Output: $OutputDir"
Write-Host ""

if (-not (Test-Path $SvgPath)) {
    Write-Error "SVG file not found: $SvgPath"
    exit 1
}

$sizes = @(16, 32, 48, 128)

# Try ImageMagick (magick convert)
$hasMagick = $null -ne (Get-Command "magick" -ErrorAction SilentlyContinue)

# Try Inkscape
$hasInkscape = $null -ne (Get-Command "inkscape" -ErrorAction SilentlyContinue)

if ($hasMagick) {
    Write-Host "Using ImageMagick..." -ForegroundColor Yellow
    foreach ($size in $sizes) {
        $outFile = Join-Path $OutputDir "icon${size}.png"
        Write-Host "  Generating ${size}x${size} -> $outFile"
        magick convert -background none -size ${size}x${size} $SvgPath $outFile
    }
    # Also generate varoicon128.png (same as icon128 for in-page use)
    Copy-Item (Join-Path $OutputDir "icon128.png") (Join-Path $OutputDir "varoicon128.png") -Force
    Write-Host ""
    Write-Host "✓ All icons generated!" -ForegroundColor Green
}
elseif ($hasInkscape) {
    Write-Host "Using Inkscape..." -ForegroundColor Yellow
    foreach ($size in $sizes) {
        $outFile = Join-Path $OutputDir "icon${size}.png"
        Write-Host "  Generating ${size}x${size} -> $outFile"
        inkscape $SvgPath --export-type=png --export-width=$size --export-height=$size --export-filename=$outFile
    }
    Copy-Item (Join-Path $OutputDir "icon128.png") (Join-Path $OutputDir "varoicon128.png") -Force
    Write-Host ""
    Write-Host "✓ All icons generated!" -ForegroundColor Green
}
else {
    Write-Host "⚠ No SVG converter found (ImageMagick or Inkscape)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The icons/ folder already contains PNGs from VaroChrome." -ForegroundColor Yellow
    Write-Host "To regenerate from the SVG, install one of:" -ForegroundColor Yellow
    Write-Host "  - ImageMagick:  winget install ImageMagick.ImageMagick"
    Write-Host "  - Inkscape:     winget install Inkscape.Inkscape"
    Write-Host ""
    Write-Host "Then re-run this script." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Current icon files:" -ForegroundColor Cyan
    Get-ChildItem $OutputDir -Filter "*.png" | ForEach-Object {
        Write-Host "  $($_.Name) - $([math]::Round($_.Length/1KB,1)) KB"
    }
}

Write-Host ""
Write-Host "Done."
