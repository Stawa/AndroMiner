# AndroMiner feature roadmap

A prioritized, living plan for making AndroMiner a safer, more reliable, and more useful open-source Android CPU miner. These are proposals, **not** committed release dates or claims that features are already implemented.

## Implementation status — 2026-10-31

The current implementation is described below. **Testing** means working code and local checks exist, but the full device acceptance criteria are still open. No roadmap item is marked done on the strength of its interface alone. See [validation and architecture notes](docs/ROADMAP-IMPLEMENTATION.md).

| Item                        | Status        | Implemented / remaining                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Native lifecycle         | Testing       | One service-managed runtime survives bridge recreation; serialized start/stop, explicit timestamped states, stateful notification, orphan-process cleanup, interrupted-session recovery, background help. Real XMRig lifecycle, Doze, reboot, and manufacturer restrictions still require device tests.                                    |
| 2. Protection               | Testing       | Native two-second checks; missing/non-finite required readings block/stop; threshold, source, current/last valid observation and stop reason recorded. Screen-off thermal/power/permission scenarios remain unverified.                                                                                                                    |
| 3. Connection diagnostics   | In progress   | Optional hostname/DNS/TCP/TLS reachability test, bounded IPv4/IPv6 attempts, certificate/hostname checks, safe report preview/copy. Pool authentication and combined app/device/event/log diagnostic exports remain.                                                                                                                       |
| 4. Monitoring and records   | Testing       | SQLite journal, 100-run/50-event bounds, native checkpoints and sampling, idempotent UI reconciliation, stop reasons, interrupted recovery, separate observed hashing time, monotonic duration. Storage/recovery instrumentation is written but device installation was blocked.                                                           |
| 5. Release quality          | In progress   | APK-embedded hashes and immutable miner revision, verification before execution, atomic download replacement, rejected redirects, ESLint and real tests, PR variant matrix, downloadable checksums, release signing fails without a persistent key. Signed provenance, action SHA pins, upgrade/device acceptance and CI execution remain. |
| 6. Event notifications      | Proposed      | Existing foreground Stop/Open controls retained and status made accurate. Separate stop/disconnect/share alerts remain.                                                                                                                                                                                                                    |
| 7. Duration / charging-only | Testing       | Native monotonic 0–1440 minute limit with countdown/deadline UI and history reason; existing charging-only checks take precedence. Real screen-off timer and unplug tests remain.                                                                                                                                                          |
| 8. Setup / dashboard        | In progress   | Existing onboarding, validation, measured/stale displays and timeline retained; duration and connection tests integrated into existing controls. Timeline gaps and reduced-frequency sampling remain.                                                                                                                                      |
| 9. History                  | In progress   | Date/coin/algorithm/pool/outcome filters, sample-weighted compatible averages, CPU/miner metadata, JSON preview/copy with pool identifiers off by default. Saved-setup filter and dedicated side-by-side comparison remain.                                                                                                                |
| 10. Backup / restore        | Proposed      | Existing configuration import/export retained; versioned multi-store backup, conflict preview, atomic merge/replace remain.                                                                                                                                                                                                                |
| 11. Adaptive CPU            | Proposed      | Existing static CPU profiles/affinity retained. Adaptive/background changes await sustained device safety validation.                                                                                                                                                                                                                      |
| 12. Failover                | Proposed      | Ordered compatible backups and bounded retry/session policy remain.                                                                                                                                                                                                                                                                        |
| 13. Updates                 | Investigating | Existing GitHub release checker/variant selection retained; authenticity and upgrade behavior still need a focused audit.                                                                                                                                                                                                                  |
| 14. Statistics              | Testing       | Opt-in anonymous check-ins (off by default, user-chosen country, resettable/deletable ID), self-hostable `server/`, public dashboard (`npm run build:stats`) and GitHub download counts, with privacy/API/methodology docs in `docs/`. Android device tests, a deployed service and an interactive map remain.                             |

Research items remain proposals. Device instrumentation was attempted on Android 13 but Android rejected the isolated APK with `INSTALL_FAILED_USER_RESTRICTED`; **zero device tests ran and mining was not started**.

## Project direction

AndroMiner should make _real_ mining understandable and manageable on ordinary Android devices. It uses a native ARM64 XMRig-compatible miner with a Vue/Capacitor interface and currently distributes bundled-TLS, bundled-no-TLS, and downloader APK variants.

Prioritize, in order:

1. **Correctness and safety:** truthful status, accurate measurements, predictable stopping, and protection limits.
2. **Android reliability:** sensible behavior when the UI closes, the screen locks, or Android restricts background work.
3. **Troubleshooting:** explain why a session failed instead of displaying vague connection errors.
4. **Usability:** clear setup, live monitoring, useful history, and accessible controls.
5. **Trust and maintainability:** verifiable releases, good diagnostics, reproducible testing, and minimal data collection.

Priority labels are not a release schedule: **P0** is foundational; **P1** is the next set of user-facing improvements; **P2** is valuable after the foundations work; **Research** requires a feasibility and safety review.

## Non-negotiable behavior

- Mining starts only after an explicit user action. Reopening the app, restoring state, rebooting, updating, or receiving a remote message must not silently start mining.
- A manual stop, a session deadline, and a protection stop take precedence over reconnects, failover, and future automation.
- Keep mining visible while active, with a persistent Android foreground-service notification and an accessible Stop action where supported. Respect Android foreground-service requirements and background execution limits; do not promise that a device will _never_ suspend the app.
- Do not disable thermal or battery protection to increase hashrate. Do not silently increase thread counts beyond the user's selected maximum.
- Report **measured**, **estimated**, **unavailable**, and **stale** values differently. Never display missing sensor readings as zero or fabricate pool earnings.
- Keep saved setups and session history local by default. No account, cloud upload, analytics, or tracking is required for mining.
- Never send wallet addresses, pool passwords, diagnostic logs, or mining status to a server without clear, specific consent. Do not conceal a developer wallet, donation percentage, or pool destination.
- Prefer encrypted pool connections when supported. Never silently downgrade a TLS-required configuration to plaintext.
- Do not introduce a new engine, coin, or Android permission without a clear purpose, disclosure, licensing review, and real-device tests.

---

## P0 — Reliability, safety, and trustworthy releases

### 1. Native session lifecycle and background operation

- Make the native Android service the single source of truth for the miner process and session status.
- Define explicit states such as `idle`, `starting`, `connecting`, `running`, `stopping`, `stopped`, and `failed`, with a reason code and timestamp.
- Reconcile the interface against the existing native process when the app reopens. Never spawn a second miner because the web view was recreated.
- Keep the foreground notification accurate, including a working Stop action and a clear distinction between connecting and actively hashing.
- Verify the service declaration, required permissions, and foreground-service type against supported Android API levels. Do not misuse another service type to evade restrictions.
- Provide a **Background operation** help screen that explains battery optimization settings, manufacturer restrictions, and why continuous operation cannot be guaranteed.
- Handle app swipes, screen lock, Doze, battery saver, loss of notification permission, system process termination, and device reboot without making false status claims.

**Done when:** reopening the UI restores the correct state; only one miner process exists; the user can stop it from the available controls; and unexpected Android termination is correctly recorded, never silently resumed.

### 2. Strengthen thermal, battery, and power protection

- Audit existing protections at the native-service level so they continue working when the web view is not visible.
- Record threshold, sensor source, last valid reading, action taken, and the reason a run stopped.
- Treat unavailable mandatory safety measurements as an explicit degraded or blocked condition; never interpret `null` as a safe temperature.
- Use a stable policy for temperature spikes, persistent high temperature, low battery, and loss of power during charging-only sessions, with documented defaults.
- Distinguish CPU temperature, battery temperature, and Android thermal-status signals; label each according to its actual source and reliability.
- Never let reconnect, adaptive tuning, or failover override a protection stop.

**Done when:** protection stops work with the display off and still work when permissions, sensors, or readings are missing. The reason remains visible after reopening the app.

### 3. Pool connection test and actionable diagnostics

- Add an optional preflight test with separately reported stages: hostname validation, DNS A/AAAA resolution, TCP connection, TLS handshake/certificate checks when selected, and optional pool-protocol authentication.
- Distinguish DNS failure, unreachable host/port, timeout, rejected TLS, wrong protocol, rejected wallet/worker credentials, and pool-side disconnects.
- Support IPv4/IPv6 fallback where feasible and describe which address family actually connected.
- Handle Android VPN and USB reverse-tethering environments without assuming that the connectivity API's reported network type guarantees reachability.
- Never probe or silently substitute different pool ports or disable TLS to make a test pass. Clearly identify a reachability check versus successful pool login.
- Export a diagnostic report with app/miner/build versions, Android model/version, safe network stages, session state changes, protection events, and bounded logs.
- Redact wallet addresses, pool passwords, tokens, IP identifiers, and personal data by default; preview the report before sharing it.

**Done when:** a user can determine which connection stage failed, and exports are useful without inadvertently disclosing credentials.

### 4. Accurate monitoring and resilient session records

- Show miner-reported current and rolling-average hashrate, accepted/rejected shares, active algorithm, pool state, requested versus effective threads, and native-service uptime when those values exist.
- Label averages with their sample window; show when telemetry was last received and mark stale readings rather than repeating them as live.
- Store event timestamps and sample provenance. Distinguish active hashing time from time spent connecting or waiting for a retry.
- Persist enough session data to recover an interrupted run into History, with explicit end reasons: manual stop, timer, protection, connection failure, native crash, or unexpected termination.
- On start or after restoring the UI, reconcile any interrupted record with the actual native process before changing its status.
- Limit sample retention and storage growth; handle failed writes and corrupted records without losing all history.

**Done when:** a crash, app reopening, or disconnected UI does not create duplicate runs or leave a finished run marked active. Missing values stay missing.

### 5. Supply-chain security and release quality

- Publish SHA-256 checksums for each APK and miner binary, and document how users can check them. Prefer signed release metadata and signatures over checksums alone for authenticity.
- For miner downloads, verify the expected version and integrity **before execution**; use a signed manifest or another authenticated trust mechanism, validate redirects, and keep the last verified engine if an update fails.
- Protect signing credentials in CI, pin critical build inputs where practical, and document the sources and licenses of native dependencies and any additional engines.
- Make Android and frontend checks part of CI: formatting, lint, type checking, unit tests, Gradle checks, and build validation for all three APK variants.
- Test upgrades and fresh installs, including signing-key continuity, expected ABI, executable packaging, target SDK differences, and TLS capability.
- Replace broad antivirus-disabling instructions with safer build troubleshooting and transparent instructions for verifying source and binaries.

**Done when:** release artifacts can be independently checked, a failed miner download cannot replace a good engine, and the supported APK variants are validated before publishing.

---

## P1 — Better everyday mining experience

### 6. Mining notifications and quick actions

- Notify about protection stops, unexpected termination, and prolonged connection loss, with an understandable reason and a route to the affected session.
- Keep accepted-share notifications optional and aggregated to avoid spam.
- Provide notification actions for opening the session and stopping the miner. Never expose credentials in notifications.
- Respect notification permissions and provide an in-app event log when notifications are denied.

**Done when:** an important stop is visible even if the UI is hidden, and tapping an alert never starts mining again.

### 7. Session duration and charging-only controls

- Allow a maximum session duration and optionally require charging before a session can start or continue.
- Enforce both rules in the native service, not just a JavaScript timer.
- Show the run deadline and remaining duration, using monotonic elapsed-time tracking where appropriate to avoid clock-change errors.
- Save the stop reason in History. Changes to power state or a protection stop must take precedence over the countdown.

**Done when:** time-limited and charging-only runs stop as configured with the display off, including after the UI is reopened.

### 8. Clearer setup and more understandable dashboard

- Give first-time users a short, skippable path through device compatibility, miner availability, wallet, pool, TLS, and CPU limits.
- Add validation and contextual explanations without cluttering the main screen or blocking experienced users.
- Make connection state, active pool, live hashrate, temperature source, battery state, and a prominent Stop control easy to scan.
- Add a simple session hashrate/temperature timeline, with gaps for missing samples and optional reduced-frequency sampling to limit overhead.
- Keep cards, charts, typography, and navigation consistent on small and large Android displays, with accessible labels and reduced-motion support.
- Show troubleshooting actions only when relevant to the actual error; do not overwhelm the main dashboard with advanced settings.

**Done when:** a new user can configure a valid session without guessing, and a running user can understand the state at a glance.

### 9. History filtering, comparison, and export

- Filter by date, coin, algorithm, pool, saved setup, and run outcome.
- Store CPU settings, sample counts, available thermal readings, and miner version alongside each run.
- Compare compatible runs using the same algorithm and clear sampling windows; explain why incompatible or incomplete runs should not be ranked together.
- Export selected results to CSV or JSON with a documented schema and optional redaction of identifiers.

**Done when:** users can fairly compare configurations without mixing algorithms or interpreting missing values as zero.

### 10. Backup and restore

- Extend the existing configuration export to optionally include saved setups, preferences, and session history.
- Version the backup schema; validate contents and size before applying them.
- Preview imports, show conflicts, and offer merge or replace. Apply changes atomically and roll back on failure.
- Exclude credentials by default or clearly require an explicit opt-in to include sensitive fields.

**Done when:** a backup restores selected data correctly, and malformed or incompatible imports leave existing data unchanged.

---

## P2 — Advanced control, resilience, and transparency

### 11. Improved CPU profiles and adaptive limits

- Start with user-selectable background throttling and show the effective settings applied by the miner.
- Explore efficiency-core selection only where reliable topology information is available; otherwise explain that it is unsupported.
- Investigate bounded adaptive thread reduction in response to thermal trends, with hysteresis to avoid rapid changes.
- Never exceed the user-selected thread maximum, silently restart the miner to change settings, or override a protection stop.

**Done when:** requested and actual settings are visible, and adaptive adjustments demonstrably respect safety limits during sustained device tests.

### 12. Pool failover and bounded retries

- Support an ordered list of user-configured backup pools with per-pool TLS requirements and clear wallet/worker mapping.
- Use bounded retries and backoff; show the reason, time, and destination of each switch.
- Do not bypass wallet validation, protection stops, or TLS requirements. Do not silently switch coin or algorithm.
- Preserve one logical user-authorized session while recording individual pool connection attempts.

**Done when:** a failed pool can move to an explicitly configured compatible backup without security downgrade or infinite retry loops.

### 13. In-app update checking

- Offer an optional check of official GitHub releases, with release notes and a link to download the correct variant.
- Explain differences between bundled TLS, bundled no-TLS, and downloader APKs instead of silently changing variants.
- Verify update authenticity, preserve existing data, and never silently install an APK or start the miner after an update.

**Done when:** users can identify a suitable newer release without accidental variant changes or lost settings.

### 14. Optional, privacy-first project statistics

- Show public GitHub Release asset download counts as **downloads**, never as unique users or installed devices.
- Only if there is sufficient community demand, offer a separate **opt-in** usage-statistics feature backed by a documented, open-source, self-hostable service.
- Explain precisely what each metric means: e.g., installations that voluntarily checked in during the last 24 hours, not all devices with the app installed.
- Minimize data: do not collect wallet addresses, pools, passwords, raw mining logs, precise location, or mining status. Do not store IP addresses in application logs; document unavoidable network metadata exposure and retention.
- Make consent off by default, independently revocable, and resettable. Publish a data schema, retention policy, and deletion procedure; allow builds with telemetry entirely disabled.
- A dashboard may show only aggregate adoption trends, app/Android versions, and opt-in active installations. Avoid real-time monitoring of individual devices.

**Done when:** mining works normally without telemetry and every public statistic has an accurate label and documented collection method.

---

## Research — Evaluate before committing

### Short local benchmark mode

Measure supported algorithms without a pool, for a fixed user-selected duration with normal safety limits, and label results as device-local performance rather than predicted earnings. Compare runs only when conditions and sampling methodology are compatible.

### Pool account statistics

Use supported, documented pool APIs for balance and payout data. Show the source, account scope, units, and last refresh time. Keep credentials optional and protected; never infer earnings from hashrate alone.

### Charging-only schedules and reconnect automation

Consider optional bounded schedules only after session recovery, native timers, and protection stops are proven reliable. Require explicit configuration and a visible status. Manual and protection stops must win; no hidden reboot autostart or remote mining activation.

### Additional mining engines and algorithms

Evaluate unsupported coins separately for Android ARM64 feasibility, build maintenance, licensing, CPU suitability, pool integration, and real-device testing. Avoid filling the interface with selectable coins that cannot actually run.

### Community documentation and accessibility

Consider translations, contributor-friendly issue templates, example setups with placeholder wallets, device compatibility notes, and a maintained troubleshooting guide before building a complex online account system.

---

## Implementation workflow

For each feature, use a small GitHub issue with:

- **Status:** proposed / investigating / in progress / testing / done.
- **Scope:** what will change, what will explicitly _not_ change, and dependencies.
- **Acceptance criteria:** reproducible behavior for success, failure, and interruption.
- **Compatibility:** affected Android API levels, miner configurations, and APK variants.
- **Security and privacy:** new permissions, collected data, downloadable code, and credential exposure.
- **Evidence:** tests, device/Android version, logs with secrets removed, and screenshots only where useful.

Prefer vertical slices that can be completed and tested on a real device. Do not mark a feature done solely because the UI exists.

## Release readiness checklist

- [ ] A real ARM64 device starts, hashes, reports real shares, and stops correctly; emulator-only success is not sufficient.
- [ ] Foreground-service and background behavior are tested with the screen off, UI closed/reopened, device under battery restrictions, and process unexpectedly terminated.
- [ ] User Stop, thermal protection, battery protection, timer, and charging-only conditions cannot be bypassed by reconnect or future automation.
- [ ] DNS failure, no internet, TCP timeout, TLS failure, pool login rejection, IPv4/IPv6 variation, and VPN/reverse-tethered environments are handled gracefully where relevant.
- [ ] Missing sensors, denied notification permission, failed storage writes, malformed history, and invalid backups are tested where relevant.
- [ ] Sample values, rolling averages, session outcomes, and pool-account data are never represented more precisely or confidently than their sources allow.
- [ ] Bundled TLS, bundled no-TLS, and downloader variants are built and checked for their intended capabilities, Android target SDK, and packaging differences.
- [ ] APK signing, miner integrity checks, release checksums/signatures, and dependency licensing have been reviewed.
- [ ] Lint, format, typecheck, native build, and automated tests pass; documentation and screenshots reflect what actually works.
- [ ] New telemetry and network permissions are opt-in or necessary and transparently explained. No wallet or pool credentials appear in logs or exported diagnostics without explicit user choice.
- [ ] The release notes distinguish shipped improvements, experimental features, and known limitations; do not claim improved hashrate, profitability, or 24/7 reliability without measured evidence.

## Useful references

- [AndroMiner source](https://github.com/Stawa/AndroMiner)
- [AndroMiner technical guide](https://github.com/Stawa/AndroMiner/blob/main/docs/TECHNICAL.md)
- [Android: foreground service requirements](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [Android: foreground service behavior changes](https://developer.android.com/develop/background-work/services/fgs/changes)
- [Android: background optimization](https://developer.android.com/topic/performance/background-optimization.html)
