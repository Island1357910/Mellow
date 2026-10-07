$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Error '还没有 git remote。先 gh repo create 或 git remote add origin <url>'
}

$repoName = if ($remote -match '/([^/]+?)(?:\.git)?$') { $Matches[1] } else { 'Mellow' }
$env:BASE_PATH = "/$repoName/"
Write-Host "Building with BASE_PATH=$($env:BASE_PATH)"
npm run build

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
Write-Host 'Done. Site updates in ~1 minute on GitHub Pages.'
