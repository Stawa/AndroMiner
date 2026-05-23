param(
  [string]$Abi = "arm64-v8a",
  [string]$AndroidPlatform = "android-29",
  [string]$XmrigRef = "master",
  [string]$LibuvRef = "v1.48.0",
  [string]$OpenSslRef = "openssl-3.3.2",
  [switch]$NoTls,
  [int]$Jobs = [Environment]::ProcessorCount
)

$ErrorActionPreference = "Stop"

$BuilderDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $BuilderDir
$WorkDir = Join-Path $BuilderDir "work"
$SrcDir = Join-Path $WorkDir "src"
$BuildDir = Join-Path $WorkDir "build"
$PrefixDir = Join-Path $WorkDir "prefix"

Write-Host "==> Starting AndroMiner XMRig Android builder"

$AndroidSdk = $env:ANDROID_HOME
if (-not $AndroidSdk) {
  $AndroidSdk = $env:ANDROID_SDK_ROOT
}
if (-not $AndroidSdk) {
  $DefaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $DefaultSdk) {
    $AndroidSdk = $DefaultSdk
  }
}
if (-not $AndroidSdk) {
  throw "Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK path."
}

$NdkDir = $env:ANDROID_NDK_HOME
if (-not $NdkDir) {
  $NdkDir = $env:ANDROID_NDK_ROOT
}
if (-not $NdkDir) {
  $NdkRoot = Join-Path $AndroidSdk "ndk"
  if (Test-Path $NdkRoot) {
    $NdkDir = Get-ChildItem -Path $NdkRoot -Directory |
      Sort-Object Name |
      Select-Object -Last 1 -ExpandProperty FullName
  }
}
if (-not $NdkDir) {
  throw "Could not find Android NDK. Install it in Android Studio or set ANDROID_NDK_HOME."
}

$Toolchain = Join-Path $NdkDir "build\cmake\android.toolchain.cmake"
if (-not (Test-Path $Toolchain)) {
  throw "Android NDK CMake toolchain was not found at $Toolchain."
}

function Find-AndroidSdkTool {
  param(
    [string]$ToolName
  )

  $Candidates = @()
  $CmakeRoot = Join-Path $AndroidSdk "cmake"
  if (Test-Path $CmakeRoot) {
    $Candidates += Get-ChildItem -Path $CmakeRoot -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName "bin\$ToolName" }
  }

  $Candidates += Join-Path $NdkDir "prebuilt\windows-x86_64\bin\$ToolName"

  foreach ($Candidate in $Candidates) {
    if (Test-Path $Candidate) {
      return $Candidate
    }
  }

  return $null
}

function Add-ToolToPath {
  param(
    [string]$ToolPath
  )

  if ($ToolPath -and (Test-Path $ToolPath)) {
    $ToolDir = Split-Path -Parent $ToolPath
    $env:PATH = "$ToolDir;$env:PATH"
  }
}

function Find-GitForWindowsTool {
  param(
    [string]$ToolName
  )

  $ProgramFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
  $Candidates = @(
    (Join-Path $env:ProgramFiles "Git\usr\bin\$ToolName"),
    (Join-Path $ProgramFilesX86 "Git\usr\bin\$ToolName"),
    (Join-Path $env:LOCALAPPDATA "Programs\Git\usr\bin\$ToolName")
  )

  foreach ($Candidate in $Candidates) {
    if ($Candidate -and (Test-Path $Candidate)) {
      return $Candidate
    }
  }

  return $null
}

function Find-PerlTool {
  $Candidates = @(
    "C:\msys64\usr\bin\perl.exe",
    "C:\Strawberry\perl\bin\perl.exe",
    (Find-GitForWindowsTool "perl.exe")
  )

  foreach ($Candidate in $Candidates) {
    if ($Candidate -and (Test-Path $Candidate)) {
      return $Candidate
    }
  }

  return $null
}

function Test-OpenSslPerl {
  if (-not (Get-Command perl -ErrorAction SilentlyContinue)) {
    return $false
  }

  perl -MLocale::Maketext::Simple -MIPC::Cmd -e "exit 0" *> $null
  if ($LASTEXITCODE -ne 0) {
    return $false
  }

  perl -MConfig -e "exit(`$Config::Config{osname} =~ /MSWin32/i ? 1 : 0)" *> $null
  return $LASTEXITCODE -eq 0
}

function ConvertTo-MsysPath {
  param(
    [string]$Path
  )

  $Normalized = $Path.Replace("\", "/")
  if ($Normalized -match "^([A-Za-z]):/(.*)$") {
    return "/" + $Matches[1].ToLowerInvariant() + "/" + $Matches[2]
  }

  return $Normalized
}

function Quote-Bash {
  param(
    [string]$Value
  )

  return "'" + $Value.Replace("'", "'\''") + "'"
}

function Find-MsysBash {
  $Candidates = @(
    "C:\msys64\usr\bin\bash.exe",
    "C:\msys64\mingw64\bin\bash.exe"
  )

  foreach ($Candidate in $Candidates) {
    if (Test-Path $Candidate) {
      return $Candidate
    }
  }

  return $null
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is required in PATH."
}
if (-not (Get-Command perl -ErrorAction SilentlyContinue)) {
  Write-Host "==> Locating Perl"
  Add-ToolToPath (Find-PerlTool)
} elseif (-not (Test-OpenSslPerl)) {
  Write-Host "==> Current Perl cannot build OpenSSL for Android; locating MSYS2 Perl"
  Add-ToolToPath (Find-PerlTool)
}
if (-not (Get-Command make -ErrorAction SilentlyContinue)) {
  Write-Host "==> Locating Android NDK make"
  Add-ToolToPath (Find-AndroidSdkTool "make.exe")
}
if (-not $NoTls -and -not (Test-OpenSslPerl)) {
  throw "OpenSSL Android builds require MSYS2 Perl or WSL/Ubuntu Perl. Install MSYS2 Perl, then rerun this script. Use -NoTls only if you intentionally want a no-TLS miner."
}
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
  Write-Host "==> Locating Android SDK CMake"
  $SdkCmake = Find-AndroidSdkTool "cmake.exe"
  if ($SdkCmake) {
    $env:PATH = "$(Split-Path -Parent $SdkCmake);$env:PATH"
  } else {
    throw "cmake is required in PATH. Install Android Studio CMake from SDK Tools or install CMake for Windows."
  }
}
$CmakeGenerator = "Ninja"
if (-not (Get-Command ninja -ErrorAction SilentlyContinue)) {
  Write-Host "==> Locating Android SDK Ninja"
  $SdkCmakeNinja = Find-AndroidSdkTool "ninja.exe"
  if ($SdkCmakeNinja) {
    $env:PATH = "$(Split-Path -Parent $SdkCmakeNinja);$env:PATH"
  } else {
    throw "ninja is required in PATH. Install Ninja or Android Studio CMake."
  }
}

$InstallDir = Join-Path $RootDir "android\app\src\main\jniLibs\$Abi"
$OutputBinary = Join-Path $InstallDir "libxmrig.so"

New-Item -ItemType Directory -Force -Path $SrcDir, $BuildDir, $PrefixDir, $InstallDir | Out-Null

function Clone-OrUpdate {
  param(
    [string]$Repo,
    [string]$Ref,
    [string]$Dir
  )

  if (-not (Test-Path (Join-Path $Dir ".git"))) {
    git clone --depth 1 --branch $Ref $Repo $Dir
    return
  }

  git -C $Dir reset --hard
  git -C $Dir fetch --depth 1 origin $Ref
  git -C $Dir checkout FETCH_HEAD
}

function Get-AndroidApiLevel {
  param(
    [string]$Platform
  )

  if ($Platform -match "android-([0-9]+)") {
    return $Matches[1]
  }

  return "29"
}

function Get-OpenSslAndroidTarget {
  param(
    [string]$AndroidAbi
  )

  switch ($AndroidAbi) {
    "arm64-v8a" { return "android-arm64" }
    "armeabi-v7a" { return "android-arm" }
    "x86" { return "android-x86" }
    "x86_64" { return "android-x86_64" }
    default { throw "Unsupported OpenSSL Android ABI: $AndroidAbi" }
  }
}

function Build-OpenSsl {
  param(
    [string]$SourceDir,
    [string]$Prefix,
    [string]$Target,
    [string]$ApiLevel,
    [string]$Ndk
  )

  if (-not (Get-Command perl -ErrorAction SilentlyContinue)) {
    throw "perl is required to build OpenSSL. Install Strawberry Perl, MSYS2, or run the Bash builder from WSL."
  }
  if (-not (Test-OpenSslPerl)) {
    throw "OpenSSL Android builds require a Unix-like Perl with core modules. Install MSYS2 Perl or build from WSL/Ubuntu; Strawberry Perl and Git for Windows Perl are not suitable for this TLS build."
  }
  if (-not (Get-Command make -ErrorAction SilentlyContinue)) {
    if (-not (Find-MsysBash)) {
      throw "make is required to build OpenSSL. Install MSYS2 make, GnuWin32 make, or run the Bash builder from WSL."
    }
  }

  $PrebuiltHost = "windows-x86_64"
  $LlvmBin = Join-Path $Ndk "toolchains\llvm\prebuilt\$PrebuiltHost\bin"
  if (-not (Test-Path $LlvmBin)) {
    throw "Android NDK LLVM toolchain was not found at $LlvmBin."
  }

  $MsysBash = Find-MsysBash
  if ($MsysBash) {
    $MsysSourceDir = ConvertTo-MsysPath $SourceDir
    $MsysPrefix = ConvertTo-MsysPath $Prefix
    $MsysNdk = ConvertTo-MsysPath $Ndk
    $MsysLlvmBin = ConvertTo-MsysPath $LlvmBin
    $BashCommand = @(
      "set -e",
      "command -v make >/dev/null || { echo 'MSYS2 make is required. Run: pacman -S --needed --noconfirm make' >&2; exit 127; }",
      "cd $(Quote-Bash $MsysSourceDir)",
      "export ANDROID_NDK_ROOT=$(Quote-Bash $MsysNdk)",
      "export ANDROID_NDK_HOME=$(Quote-Bash $MsysNdk)",
      "export PATH=$(Quote-Bash $MsysLlvmBin):`$PATH",
      "if [ -f Makefile ]; then make clean || true; fi",
      "perl Configure $Target no-shared no-tests no-unit-test no-apps --prefix=$(Quote-Bash $MsysPrefix) --openssldir=$(Quote-Bash "$MsysPrefix/ssl") -D__ANDROID_API__=$ApiLevel",
      "make -j $Jobs",
      "make install_sw"
    ) -join "; "

    & $MsysBash -lc $BashCommand
    if ($LASTEXITCODE -ne 0) {
      throw "OpenSSL build failed."
    }
    return
  }

  $PreviousPath = $env:PATH
  $PreviousNdkRoot = $env:ANDROID_NDK_ROOT
  $PreviousNdkHome = $env:ANDROID_NDK_HOME
  $LocationPushed = $false
  $OpenSslNdk = $Ndk.Replace("\", "/")
  $OpenSslLlvmBin = $LlvmBin.Replace("\", "/")
  $OpenSslPrefix = $Prefix.Replace("\", "/")
  try {
    $env:ANDROID_NDK_ROOT = $OpenSslNdk
    $env:ANDROID_NDK_HOME = $OpenSslNdk
    $env:PATH = "$OpenSslLlvmBin;$env:PATH"

    if (Test-Path (Join-Path $SourceDir "Makefile")) {
      make -C $SourceDir clean
    }

    Push-Location $SourceDir
    $LocationPushed = $true
    perl Configure $Target no-shared no-tests no-unit-test no-apps "--prefix=$OpenSslPrefix" "--openssldir=$OpenSslPrefix/ssl" "-D__ANDROID_API__=$ApiLevel"
    if ($LASTEXITCODE -ne 0) {
      throw "OpenSSL configure failed."
    }
    make -j $Jobs
    if ($LASTEXITCODE -ne 0) {
      throw "OpenSSL build failed."
    }
    make install_sw
    if ($LASTEXITCODE -ne 0) {
      throw "OpenSSL install failed."
    }
  } finally {
    if ($LocationPushed) {
      Pop-Location
    }
    $env:PATH = $PreviousPath
    $env:ANDROID_NDK_ROOT = $PreviousNdkRoot
    $env:ANDROID_NDK_HOME = $PreviousNdkHome
  }
}

function Patch-OpenSslAndroidConfig {
  param(
    [string]$SourceDir
  )

  $ConfigPath = Join-Path $SourceDir "Configurations\15-android.conf"
  if (-not (Test-Path $ConfigPath)) {
    throw "OpenSSL Android configuration file was not found at $ConfigPath."
  }

  $Text = Get-Content -Raw $ConfigPath
  if ($Text.Contains("AndroMiner Android path normalization")) {
    return
  }

  $Text = $Text.Replace(
    '            $ndk = canonpath($ndk);',
    "            `$ndk = canonpath(`$ndk);`n            # AndroMiner Android path normalization for Windows-hosted builds.`n            `$ndk =~ s|\\|/|g;"
  )
  $Text = $Text.Replace(
    '            if (which("clang") =~ m|^$ndk/.*/prebuilt/([^/]+)/|) {',
    "            (my `$clang_path = which(`"clang`")) =~ s|\\|/|g;`n            if (`$clang_path =~ m|^`$ndk/.*/prebuilt/([^/]+)/|) {"
  )
  $Text = $Text.Replace(
    '                if (which("llvm-ar") =~ m|^$ndk/.*/prebuilt/([^/]+)/|) {',
    "                (my `$llvm_ar_path = which(`"llvm-ar`")) =~ s|\\|/|g;`n                if (`$llvm_ar_path =~ m|^`$ndk/.*/prebuilt/([^/]+)/|) {"
  )
  $Text = $Text.Replace(
    '                if (which("$triarch-gcc") !~ m|^$ndk|) {',
    "                (my `$gcc_path = which(`"`$triarch-gcc`")) =~ s|\\|/|g;`n                if (`$gcc_path !~ m|^`$ndk|) {"
  )

  $Text | Set-Content -NoNewline $ConfigPath
}

Write-Host "==> Android SDK: $AndroidSdk"
Write-Host "==> Android NDK: $NdkDir"
Write-Host "==> ABI: $Abi"
Write-Host "==> Android platform: $AndroidPlatform"

$LibuvSrc = Join-Path $SrcDir "libuv"
$LibuvBuild = Join-Path $BuildDir "libuv-$Abi"
$LibuvPrefix = Join-Path $PrefixDir "libuv-$Abi"
$OpenSslSrc = Join-Path $SrcDir "openssl"
$OpenSslPrefix = Join-Path $PrefixDir "openssl-$Abi"

Write-Host "==> Fetching libuv ($LibuvRef)"
Clone-OrUpdate "https://github.com/libuv/libuv.git" $LibuvRef $LibuvSrc

Write-Host "==> Building libuv"
if (Test-Path (Join-Path $LibuvBuild "CMakeCache.txt")) {
  Remove-Item -Recurse -Force $LibuvBuild
}
cmake -G $CmakeGenerator -S $LibuvSrc -B $LibuvBuild `
  -DCMAKE_TOOLCHAIN_FILE="$Toolchain" `
  -DANDROID_ABI="$Abi" `
  -DANDROID_PLATFORM="$AndroidPlatform" `
  -DCMAKE_BUILD_TYPE=Release `
  -DCMAKE_INSTALL_PREFIX="$LibuvPrefix" `
  -DBUILD_TESTING=OFF `
  -DLIBUV_BUILD_TESTS=OFF
if ($LASTEXITCODE -ne 0) {
  throw "libuv CMake configure failed."
}
cmake --build $LibuvBuild --target install --parallel $Jobs
if ($LASTEXITCODE -ne 0) {
  throw "libuv build failed."
}

$UvInclude = Join-Path $LibuvPrefix "include"
$UvLibrary = Get-ChildItem -Path $LibuvPrefix -Recurse -Filter "libuv*.a" |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $UvLibrary) {
  throw "Could not find built libuv static library."
}

$OpenSslCmakeArgs = @()
if ($NoTls) {
  Write-Host "==> Skipping OpenSSL because -NoTls was passed"
} else {
  $OpenSslTarget = Get-OpenSslAndroidTarget $Abi
  $AndroidApiLevel = Get-AndroidApiLevel $AndroidPlatform

  Write-Host "==> Fetching OpenSSL ($OpenSslRef)"
  Clone-OrUpdate "https://github.com/openssl/openssl.git" $OpenSslRef $OpenSslSrc
  Patch-OpenSslAndroidConfig $OpenSslSrc

  Write-Host "==> Building OpenSSL ($OpenSslTarget, API $AndroidApiLevel)"
  if (Test-Path $OpenSslPrefix) {
    Remove-Item -Recurse -Force $OpenSslPrefix
  }
  New-Item -ItemType Directory -Force -Path $OpenSslPrefix | Out-Null
  Build-OpenSsl $OpenSslSrc $OpenSslPrefix $OpenSslTarget $AndroidApiLevel $NdkDir

  $OpenSslCmakeArgs = @(
    "-DOPENSSL_ROOT_DIR=$OpenSslPrefix",
    "-DOPENSSL_USE_STATIC_LIBS=TRUE",
    "-DOPENSSL_INCLUDE_DIR=$OpenSslPrefix\include",
    "-DOPENSSL_SSL_LIBRARY=$OpenSslPrefix\lib\libssl.a",
    "-DOPENSSL_CRYPTO_LIBRARY=$OpenSslPrefix\lib\libcrypto.a"
  )
}

$XmrigSrc = Join-Path $SrcDir "xmrig"
$XmrigBuild = Join-Path $BuildDir "xmrig-$Abi"

Write-Host "==> Fetching XMRig ($XmrigRef)"
Clone-OrUpdate "https://github.com/xmrig/xmrig.git" $XmrigRef $XmrigSrc

$XmrigCmake = Join-Path $XmrigSrc "CMakeLists.txt"
$XmrigCmakeText = Get-Content -Raw $XmrigCmake
if ($XmrigCmakeText.Contains("pthread rt dl log")) {
  $XmrigCmakeText = $XmrigCmakeText.Replace("pthread rt dl log", "dl")
}
if ($XmrigCmakeText.Contains("if (WIN32)")) {
  $XmrigCmakeText = $XmrigCmakeText.Replace("if (WIN32)", "if (WIN32 AND NOT ANDROID)")
}
if ($XmrigCmakeText.Contains("NOT CMAKE_GENERATOR STREQUAL Xcode)")) {
  $XmrigCmakeText = $XmrigCmakeText.Replace(
    "NOT CMAKE_GENERATOR STREQUAL Xcode)",
    "NOT CMAKE_GENERATOR STREQUAL Xcode AND NOT ANDROID)"
  )
}
$XmrigCmakeText | Set-Content -NoNewline $XmrigCmake

$TlsValue = if ($NoTls) { "OFF" } else { "ON" }
Write-Host "==> Building XMRig (TLS=$TlsValue, HTTP API enabled, hwloc disabled)"
if (Test-Path (Join-Path $XmrigBuild "CMakeCache.txt")) {
  Remove-Item -Recurse -Force $XmrigBuild
}
$XmrigCmakeArgs = @(
  "-G", $CmakeGenerator,
  "-S", $XmrigSrc,
  "-B", $XmrigBuild,
  "-DCMAKE_TOOLCHAIN_FILE=$Toolchain",
  "-DANDROID_ABI=$Abi",
  "-DANDROID_PLATFORM=$AndroidPlatform",
  "-DCMAKE_BUILD_TYPE=Release",
  "-DWITH_TLS=$TlsValue",
  "-DWITH_HTTP=ON",
  "-DWITH_HWLOC=OFF",
  "-DWITH_OPENCL=OFF",
  "-DWITH_CUDA=OFF",
  "-DBUILD_STATIC=OFF",
  "-DUV_INCLUDE_DIR=$UvInclude",
  "-DUV_LIBRARY=$UvLibrary"
) + $OpenSslCmakeArgs
cmake @XmrigCmakeArgs
if ($LASTEXITCODE -ne 0) {
  throw "XMRig CMake configure failed."
}
cmake --build $XmrigBuild --parallel $Jobs
if ($LASTEXITCODE -ne 0) {
  throw "XMRig build failed."
}

$BuiltXmrig = $null
foreach ($Name in @("xmrig", "xmrig-notls", "xmrig.exe", "xmrig-notls.exe")) {
  $Candidate = Join-Path $XmrigBuild $Name
  if (Test-Path $Candidate) {
    $BuiltXmrig = $Candidate
    break
  }
}
if (-not $BuiltXmrig) {
  $BuiltXmrig = Get-ChildItem -Path $XmrigBuild -Recurse -File |
    Where-Object { $_.Name -in @("xmrig", "xmrig-notls", "xmrig.exe", "xmrig-notls.exe") } |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $BuiltXmrig) {
  throw "XMRig build finished, but the xmrig executable was not found."
}

Copy-Item -Force $BuiltXmrig $OutputBinary

Write-Host "==> Installed Android miner:"
Write-Host "    $OutputBinary"
Write-Host ""
Write-Host "Next:"
Write-Host "  npm run android:sync"
Write-Host "  cd android"
Write-Host "  .\gradlew.bat assembleDebug"
