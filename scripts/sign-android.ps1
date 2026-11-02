param(
  [Parameter(Mandatory=$true)][string]$JavaPath,
  [Parameter(Mandatory=$true)][string]$ApkSignerJar,
  [Parameter(Mandatory=$true)][string]$InputApk,
  [string]$Version = '1.1.9'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$signRoot = Join-Path $root 'artifacts/android-signing'
$store = Join-Path $signRoot 'mellow-release.p12'
$password = Join-Path $signRoot 'password.txt'
$output = Join-Path $root "artifacts/Mellow-$Version.apk"
foreach ($path in @($JavaPath, $ApkSignerJar, $InputApk, $store, $password)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "缺少打包文件：$path" }
}
& $JavaPath -jar $ApkSignerJar sign --ks $store --ks-type PKCS12 --ks-key-alias mellow --ks-pass ("file:" + $password) --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --out $output $InputApk
if ($LASTEXITCODE -ne 0) { throw 'APK 签名失败' }
& $JavaPath -jar $ApkSignerJar verify --verbose --print-certs $output
if ($LASTEXITCODE -ne 0) { throw 'APK 签名验证失败' }
$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText((Join-Path $root "artifacts/Mellow-$Version.sha256.txt"), "$hash  Mellow-$Version.apk`n", [Text.Encoding]::ASCII)
Get-Item -LiteralPath $output | Select-Object Name, Length, FullName
