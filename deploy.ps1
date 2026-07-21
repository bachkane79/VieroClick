<#
.SYNOPSIS
    Redeploy VieroClick after pulling changes.

.DESCRIPTION
    Deploy-only: rebuilds the Docker images and (re)starts the full stack
    defined in infra/docker-compose.yml (web, agent-api, worker, scheduler,
    redis, nginx). Does NOT pull from git — run `git pull`
    yourself first, then run this script.

    Nginx serves the app on http://localhost:1988

.EXAMPLE
    ./deploy.ps1
    ./deploy.ps1 -Detach:$false   # stream logs in the foreground
#>
[CmdletBinding()]
param(
    # Run the stack in the background (default). Use -Detach:$false to stream logs.
    [bool]$Detach = $true
)

$ErrorActionPreference = "Stop"

# Always operate from the repo root (the dir this script lives in).
$RepoRoot   = $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot "infra/docker-compose.yml"
$EnvFile     = Join-Path $RepoRoot ".env"

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}
if (-not (Test-Path $EnvFile)) {
    throw ".env not found at repo root: $EnvFile (copy from .env.example and fill it in)"
}

# Ensure docker is available.
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker not found on PATH. Is Docker Desktop installed and running?"
}

Write-Host "==> Building and (re)starting VieroClick stack..." -ForegroundColor Cyan

$composeArgs = @("compose", "-f", $ComposeFile, "up", "--build", "--remove-orphans")
if ($Detach) {
    $composeArgs += "-d"
}

# docker writes its normal build/run progress to stderr. Under
# $ErrorActionPreference = "Stop" PowerShell would turn those stderr lines
# into a terminating NativeCommandError even on a successful (exit 0) build,
# so relax it for the docker call and judge success by the exit code alone.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& docker @composeArgs
$dockerExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP

if ($dockerExit -ne 0) {
    throw "docker compose up failed with exit code $dockerExit"
}

# nginx resolves its upstreams (web:3000, agent-api:8000) only once at startup
# and caches the IPs. When `up` recreates web/agent-api they get new IPs, but
# nginx itself is left running with stale IPs -> 502 (connection refused).
# Restart nginx so it re-resolves the recreated upstreams.
if ($Detach) {
    Write-Host "==> Restarting nginx to refresh upstream IPs..." -ForegroundColor Cyan
    $ErrorActionPreference = "Continue"
    & docker compose -f $ComposeFile restart nginx
    $nginxExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($nginxExit -ne 0) {
        throw "docker compose restart nginx failed with exit code $nginxExit"
    }
}

if ($Detach) {
    Write-Host ""
    Write-Host "==> Deploy complete. Services:" -ForegroundColor Green
    & docker compose -f $ComposeFile ps
    Write-Host ""
    Write-Host "App available at http://localhost:1988" -ForegroundColor Green
    Write-Host "Logs: docker compose -f `"$ComposeFile`" logs -f" -ForegroundColor DarkGray
}
