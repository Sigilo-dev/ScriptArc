param(
  [switch]$SkipBuild,
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$version = (Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version

Push-Location $repoRoot
try {
  node scripts/check-version.mjs
  if ($LASTEXITCODE -ne 0) { throw "ScriptArc version files do not match." }
} finally {
  Pop-Location
}

if (-not $SkipBuild) {
  Push-Location $repoRoot
  try {
    pnpm tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
}

$binaryPath = Join-Path $repoRoot "src-tauri\target\release\ScriptArc.exe"
if (-not (Test-Path -LiteralPath $binaryPath -PathType Leaf)) {
  throw "Built ScriptArc.exe was not found at $binaryPath. Run pnpm tauri build first."
}

if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot "dist-release" }
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$zipPath = Join-Path $OutputDirectory "ScriptArc-v$version-windows-x64-portable.zip"
$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("scriptarc-portable-" + [guid]::NewGuid().ToString("N"))
$packageDirectory = Join-Path $stageRoot "ScriptArc"

try {
  New-Item -ItemType Directory -Force -Path $packageDirectory | Out-Null
  Copy-Item -LiteralPath $binaryPath -Destination (Join-Path $packageDirectory "ScriptArc.exe")
  Copy-Item -LiteralPath (Join-Path $repoRoot "scripts\portable-README.txt") -Destination (Join-Path $packageDirectory "README.txt")
  Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSE") -Destination (Join-Path $packageDirectory "LICENSE.txt")
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Compress-Archive -Path $packageDirectory -DestinationPath $zipPath -CompressionLevel Optimal

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName })
    foreach ($required in @("ScriptArc/ScriptArc.exe", "ScriptArc/README.txt", "ScriptArc/LICENSE.txt")) {
      if ($required -notin $entries) { throw "Portable archive is missing $required." }
    }
    if ($entries.Count -ne 3) { throw "Portable archive includes unexpected files: $($entries -join ', ')" }
  } finally {
    $archive.Dispose()
  }
  if ($env:GITHUB_OUTPUT) { Add-Content -LiteralPath $env:GITHUB_OUTPUT -Value "path=$zipPath" }
  Write-Output "Portable package created: $zipPath"
} finally {
  $safeTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd("\") + "\"
  $resolvedStage = [System.IO.Path]::GetFullPath($stageRoot)
  if ($resolvedStage.StartsWith($safeTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
