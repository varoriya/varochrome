# Font subsetting script for Varo for AiPASS
# Reduces MaterialSymbolsOutlined.woff2 from ~3.8MB to ~10KB
# by keeping only the icons actually used in the extension.
#
# Requirements: Python 3 + fonttools (pip install fonttools brotli)
# Run: .\optimize-font.ps1

$ErrorActionPreference = "Stop"

$fontDir = Join-Path $PSScriptRoot "fonts"
$inputFont = Join-Path $fontDir "MaterialSymbolsOutlined.woff2"
$outputFont = Join-Path $fontDir "MaterialSymbolsOutlined.woff2"

if (-not (Test-Path $inputFont)) {
    Write-Host "Font not found: $inputFont"
    Write-Host "Download from: https://fonts.google.com/icons"
    exit 1
}

# Icons used in the extension (Material Symbols codepoints)
# From studio.js: close, toll, palette, movie, record_voice_over, upload, bolt,
#   download, schedule, history, crop_free, add_reaction, auto_fix_high,
#   domino_mask, vrpano, verified
# From content.css: (various symbols used in actionbar)
# Total: ~16 icons

$codepoints = @{
    "close"            = 0xE5CD
    "toll"             = 0xE620
    "palette"          = 0xE40A
    "movie"            = 0xE404
    "record_voice_over" = 0xE91F
    "upload"           = 0xE09C
    "bolt"             = 0xEA54
    "download"         = 0xE2C4
    "schedule"         = 0xE8B5
    "history"          = 0xE889
    "crop_free"        = 0xE3C2
    "add_reaction"     = 0xE1D7
    "auto_fix_high"    = 0xE655
    "domino_mask"      = 0xE20D  # approximate
    "vrpano"           = 0xE653  # approximate
    "verified"         = 0xEF76
    "close_small"      = 0xE5CD  # same as close
}

$hexCodepoints = $codepoints.Values | ForEach-Object { "0x{0:X}" -f $_ } | Sort-Object -Unique

Write-Host "=== Font Subsetting ===" -ForegroundColor Cyan
Write-Host "Input: $inputFont"
Write-Host "Icons to keep: $($codepoints.Count)"
Write-Host ""

# Check if Python + fonttools is available
$hasPython = $null -ne (Get-Command "python" -ErrorAction SilentlyContinue)
if (-not $hasPython) {
    Write-Host "Python not found. Install with: winget install Python.Python.3"
    Write-Host ""
    Write-Host "Manual font subsetting instructions:"
    Write-Host "1. Install Python: winget install Python.Python.3"
    Write-Host "2. Install fonttools: pip install fonttools brotli"
    Write-Host "3. Re-run this script"
    Write-Host ""
    Write-Host "Alternative: Download subset from https://fonts.google.com/icons"
    Write-Host "  Search each icon, download the WOFF2, merge manually."
    Write-Host ""
    Write-Host "For now, the full font (3.8 MB) will be used."
    Write-Host "Chrome Web Store accepts ZIP up to 500 MB, so this is acceptable."
    exit 0
}

# Check if fonttools is installed
$hasFonttools = $false
try {
    python -c "import fonttools" 2>$null
    $hasFonttools = $true
} catch {}

if (-not $hasFonttools) {
    Write-Host "Installing fonttools..."
    python -m pip install fonttools brotli
}

# Create a temporary Python script for subsetting
$pyScript = @'
import sys
from fontTools import subset
from fontTools.subset import Subsetter, Options

input_path = sys.argv[1]
output_path = sys.argv[2]
codepoints = [int(x, 16) for x in sys.argv[3:]]

options = Options()
options.flavor = "woff2"
options.drop_tables = ["GPOS", "GSUB", "GDEF", "kern", "feat", "MATH"]
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.layout_features = ["*"]
options.notdef_outline = True
options.recalc_bounds = True
options.recalc_timestamp = False
options.canonical_order = True

subsetter = Subsetter(options=options)
subsetter.populate(unicodes=codepoints)

from fontTools.ttLib import TTFont
font = TTFont(input_path)
subsetter.subset(font)
font.save(output_path)

original = len(open(input_path, "rb").read())
new = len(open(output_path, "rb").read())
print(f"Original: {original/1024:.1f} KB")
print(f"Subset:   {new/1024:.1f} KB")
print(f"Saved:    {(original-new)/1024:.1f} KB ({(1-new/original)*100:.0f}%)")
'@

$pyFile = Join-Path $env:TEMP "subset_font.py"
$pyScript | Out-File -FilePath $pyFile -Encoding utf8

$args = @($pyFile, $inputFont, $outputFont) + $hexCodepoints
Write-Host "Running fonttools subsetter..."
python @args

Write-Host ""
Write-Host "OK Font subset complete!" -ForegroundColor Green
