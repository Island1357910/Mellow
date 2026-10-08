$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Error '还没有 git remote。先 gh repo create 或 git remote add origin <url>'
}

$customDomain = if ($env:CUSTOM_DOMAIN) { $env:CUSTOM_DOMAIN } else { 'mymellow.top' }
$repoName = if ($remote -match '/([^/]+?)(?:\.git)?$') { $Matches[1] } else { 'Mellow' }

if ($customDomain) {
  $env:BASE_PATH = '/'
  Write-Host "Building for custom domain $customDomain (BASE_PATH=/)"
} else {
  $env:BASE_PATH = "/$repoName/"
  Write-Host "Building with BASE_PATH=$($env:BASE_PATH)"
}

$commit = git rev-parse --short HEAD 2>$null
if ($commit) {
  $env:BUILD_ID = "$commit.$(Get-Date -Format 'yyyyMMddHHmmss')"
} else {
  $env:BUILD_ID = "local.$(Get-Date -Format 'yyyyMMddHHmmss')"
}
Write-Host "BUILD_ID=$($env:BUILD_ID)"

npm run build

if ($customDomain) {
  Set-Content -Path (Join-Path $root 'dist/CNAME') -Value $customDomain -NoNewline
  Add-Content -Path (Join-Path $root 'dist/CNAME') -Value ''
}

$tmp = Join-Path $env:TEMP 'mellow-gh-pages'
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item -Recurse -Force (Join-Path $root 'dist/*') $tmp
Set-Location $tmp
git init -b gh-pages | Out-Null
git add -A
git commit -m "Deploy GitHub Pages $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git remote add origin $remote
git push -f origin gh-pages
Write-Host "Done. Site: https://$customDomain/ (DNS 生效后) or https://island1357910.github.io/$repoName/"
