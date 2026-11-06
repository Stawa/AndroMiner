# Introduction

AndroMiner is an open-source Android app that mines coins on the phone's CPU. It drives XMRig-compatible miner binaries from a Vue interface, and a native foreground service keeps the run alive and protects the device.

## What it does

- Mines RandomX, GhostRider and CryptoNight-CCX coins, plus Scala's Panthera through XLArig.
- Lets you choose a coin, wallet, worker and pool over TCP or TLS, and test the pool connection first.
- Offers CPU profiles (battery saver, balanced, performance, custom) with threads, priority and core affinity.
- Shows measured hashrate, accepted and rejected shares, temperature and battery readings.
- Steps through Normal, Caution, Throttled and Stop when your temperature or battery limits are reached.
- Keeps setups and session history on the phone.

## What it does not do

- It does not estimate earnings or pool payouts.
- It does not make money in any meaningful amount. A phone hashes RandomX in the hundreds to low thousands per second.
- Starting automatically, background throttling, automatic efficiency-core preference and individual event notifications are not implemented.
- GPU mining is not supported. The only hardware mode is `cpu`.

## How the pieces fit

| Layer          | Technology                               | Where                       |
| -------------- | ---------------------------------------- | --------------------------- |
| Interface      | Vue 3, TypeScript, Pinia, Tailwind CSS 4 | `src/`                      |
| Bridge         | Capacitor 8 plugins                      | `android/app/src/main/java` |
| Mining runtime | Foreground service, native miner process | `android/`                  |
| Miner binaries | XMRig, XMRigCC, XLArig built for Android | `miner-builder/`            |
| Public site    | Vue pages, built separately              | `website/`                  |
| Statistics API | Node service, SQLite or Firestore        | `server/`                   |

## Where to go next

- [Install an APK](/docs/getting-started/installation) and run your first session.
- [Set up a development environment](/docs/getting-started/development-setup) to build from source.
- Read the [application architecture](/docs/architecture/application-architecture) before changing code.
