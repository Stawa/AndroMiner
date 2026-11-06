# Installation

Get an APK from [GitHub Releases](https://github.com/Stawa/AndroMiner/releases), open it on your phone, and allow installation from that source if Android asks. The [download section](/#download) on the home page shows the latest release with sizes and checksums.

## Choose a variant

| APK                             | Mining engine                 | Pool connections                    |
| ------------------------------- | ----------------------------- | ----------------------------------- |
| `androminer-tls-<tag>.apk`      | Bundled with TLS              | Encrypted or plain TCP              |
| `androminer-notls-<tag>.apk`    | Bundled without TLS           | Plain TCP only                      |
| `androminer-download-<tag>.apk` | Downloaded after confirmation | Choose TLS or no TLS on first start |

For encrypted pool connections without a separate miner download, choose the TLS APK. The downloader APK accepts only the miner revision and SHA-256 hashes embedded in that APK, checks them before execution and replaces files atomically.

## Verify the download

Each release includes a `SHA256SUMS` file and lists checksums in the release notes.

```bash
sha256sum -c SHA256SUMS
```

```powershell
Get-FileHash .\androminer-tls-<tag>.apk -Algorithm SHA256
```

A checksum detects a changed file. It does not prove who built it; APK signing key continuity is what authenticates updates.

## Device compatibility

- The app declares Android 7 (API 24) as its minimum. That does not guarantee the mining engine runs on every device at that level.
- Bundled APKs carry `arm64-v8a` and `armeabi-v7a` engines. The 32-bit build runs RandomX in light mode, so expect lower speeds.
- Bundled APKs target SDK 35. The downloader targets SDK 28 so Android permits executing a downloaded miner from app storage.
- Check **About → Installed mining engine** for the installed binary's details.

## First run

1. Read the workload warning and complete the device check.
2. Open **Miner → Setup**, choose a coin, and replace the placeholder with your wallet address.
3. In **Pool**, enter host, port and protocol. Encrypted pools need the TLS miner.
4. Choose a CPU profile in **Engine**, then review **Safety** and **Settings → Power & protection**.
5. Allow Android notifications. Every run needs an ongoing notification with a Stop control.
6. Start from **Overview** and confirm the workload. Stopping saves the run to **History**.
