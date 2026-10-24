param(
  [ValidateSet('dev', 'start', 'build', 'sample', 'test', 'typecheck', 'install')]
  [string]$Mode = 'dev'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNodeCandidates = @()
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($taskNodeCommand) { $taskNodeCandidates += $taskNodeCommand.Source }
$taskNodeCandidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$taskNode = $null
foreach ($candidate in $taskNodeCandidates) {
  if (Test-Path -LiteralPath $candidate) {
    $taskNodeVersion = & $candidate -p 'process.versions.node'
    if ([version]$taskNodeVersion -ge [version]'22.13.0') { $taskNode = $candidate; break }
  }
}
if (!$taskNode) { throw 'Node.js 22.13+ is required. Install Node.js LTS, then run this script again.' }
if ($Mode -eq 'install') {
  $taskNpm = Get-Command npm.cmd -ErrorAction Stop
  $taskNpmCli = Join-Path (Split-Path $taskNpm.Source -Parent) 'node_modules\npm\bin\npm-cli.js'
  if (!(Test-Path -LiteralPath $taskNpmCli)) { throw 'npm CLI was not found. Install Node.js LTS with npm.' }
  & $taskNode $taskNpmCli ci
} elseif ($Mode -eq 'test') {
  $taskTests = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'tests') -Filter '*.test.ts' | ForEach-Object { $_.FullName })
  & $taskNode --experimental-strip-types --test @taskTests
} elseif ($Mode -eq 'typecheck') {
  & $taskNode 'node_modules/typescript/bin/tsc' --noEmit
} else {
  & $taskNode 'scripts/run.mjs' $Mode
}
exit $LASTEXITCODE
