# Statistics methodology

What the public numbers mean and how they are counted.

## Definitions

| Metric                       | Meaning                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release downloads            | Sum of `download_count` for `.apk` files across non-draft GitHub releases. Counts HTTP downloads, including repeats, mirrors and bots. **Not users or devices.** |
| Daily active installations   | Installations with reporting on whose last accepted check-in was in the past 24 hours.                                                                           |
| Weekly active installations  | Same, past 7 days.                                                                                                                                               |
| Monthly active installations | Same, past 30 days.                                                                                                                                              |
| Estimated active             | The monthly figure.                                                                                                                                              |

None of these is a total of installations or users. Every installation figure is a **lower bound**, because only installations that leave reporting on are counted.

## How counting works

- Each installation has one random ID. The server keeps one row per ID, updated in place, with no check-in history.
- A check-in within 20 hours (configurable) of the last accepted one is acknowledged but not counted, so retries and duplicates don't inflate numbers. It still applies changes to what the user shares.
- Daily series: if an ID's previous check-in was on an earlier UTC day, that day's counter goes up by one. Monthly series work the same way per UTC month. An installation counts at most once a day and once a month.
- Time windows use the server clock. Client clocks are never sent or trusted.
- Version, Android and variant breakdowns cover installations active in the last 30 days, each under its most recent report.
- Download history is a daily snapshot of the GitHub total, taken when the service refreshes its cached GitHub data. A day with no visits to the statistics endpoint may have no snapshot.

## Small groups

A breakdown is published only when at least `MIN_GROUP_SIZE` (default 10) installations are active. Smaller groups are combined into "Other".

If "Other" is itself below the minimum, the next-smallest group is added to it. Otherwise someone could subtract the published groups from the total and learn a small group's size. Installations with no country appear as "Country not shared".

## Limitations

- **Self-selection:** people who keep reporting on differ from all users. Countries with many privacy-minded users may be under-represented.
- **No identity checks:** someone can reset their ID or script fake check-ins. Rate limits and an hourly cap on new installations reduce this but can't remove it.
- **Reinstalls and cleared app data** create a new ID. The old one stays counted until it ages out.
- **Country** is whatever the user picked and isn't verified.
- **Past days don't change when a record is deleted**, because aggregates can't be traced to a record.
- **GitHub download counts** include repeats and can't be tied to installations.
