param(
  [string]$Abi = "arm64-v8a",
  [string]$AndroidPlatform = "android-29",
  [string]$XmrigRef = "master",
  [string]$LibuvRef = "v1.48.0",
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

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is required in PATH."
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

  git -C $Dir fetch --depth 1 origin $Ref
  git -C $Dir checkout FETCH_HEAD
}

Write-Host "==> Android SDK: $AndroidSdk"
Write-Host "==> Android NDK: $NdkDir"
Write-Host "==> ABI: $Abi"
Write-Host "==> Android platform: $AndroidPlatform"

$LibuvSrc = Join-Path $SrcDir "libuv"
$LibuvBuild = Join-Path $BuildDir "libuv-$Abi"
$LibuvPrefix = Join-Path $PrefixDir "libuv-$Abi"

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

Write-Host "==> Building XMRig without TLS/hwloc for first Android target"
if (Test-Path (Join-Path $XmrigBuild "CMakeCache.txt")) {
  Remove-Item -Recurse -Force $XmrigBuild
}
cmake -G $CmakeGenerator -S $XmrigSrc -B $XmrigBuild `
  -DCMAKE_TOOLCHAIN_FILE="$Toolchain" `
  -DANDROID_ABI="$Abi" `
  -DANDROID_PLATFORM="$AndroidPlatform" `
  -DCMAKE_BUILD_TYPE=Release `
  -DWITH_TLS=OFF `
  -DWITH_HTTPD=OFF `
  -DWITH_HWLOC=OFF `
  -DWITH_OPENCL=OFF `
  -DWITH_CUDA=OFF `
  -DBUILD_STATIC=OFF `
  -DUV_INCLUDE_DIR="$UvInclude" `
  -DUV_LIBRARY="$UvLibrary"
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
