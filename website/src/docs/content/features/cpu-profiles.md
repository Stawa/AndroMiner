# CPU profiles

A profile bundles thread count, core affinity, priority and a temperature limit. The presets are defined in `src/composables/useMiningController.ts` as `profilePresets`.

| Profile         | Threads | Affinity | Priority | Thermal limit |
| --------------- | ------- | -------- | -------- | ------------- |
| `battery_saver` | 1       | `little` | `low`    | 40 °C         |
| `balanced`      | 2       | `auto`   | `low`    | 42 °C         |
| `performance`   | 4       | `big`    | `normal` | 44 °C         |
| `custom`        | 2       | `auto`   | `low`    | 42 °C         |

Types: `MiningProfile`, `CpuAffinity` (`auto`, `little`, `big`, `custom`) and `CpuPriority` (`low`, `normal`, `high`) in `src/types/mining.ts`.

## Using them

- Pick a profile in **Engine**. `ProfileChip` renders each option.
- Choosing `custom` lets you set threads, priority and affinity yourself.
- The live session view can switch profile through `SessionControls`.

## Limits

- The 32-bit `armeabi-v7a` build runs RandomX in light mode, so threads do not scale the same way.
- Automatic efficiency-core preference and adaptive background changes are not implemented.
- Whether a phone honours affinity depends on its kernel and vendor.

Profiles set how hard the miner tries. [Device protection](/docs/features/device-protection) can still lower intensity or stop the run regardless of the profile.
