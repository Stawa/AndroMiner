# Statistics methodology

This page explains what the public numbers mean and how they are counted.

## Definitions

| Metric                       | Meaning                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release downloads            | The sum of `download_count` for `.apk` files across non-draft GitHub releases. It counts HTTP downloads, including repeats, mirrors and bots. **Not users or devices.** |
| Daily active installations   | Opted-in installations whose last accepted check-in was in the past 24 hours.                                                                                           |
| Weekly active installations  | Same, for the past 7 days.                                                                                                                                              |
| Monthly active installations | Same, for the past 30 days.                                                                                                                                             |
| Estimated active             | The monthly figure.                                                                                                                                                     |

None of these is a total number of installations or users. Every installation figure is a **lower bound**, because only people who opt in are counted.

## How counting works

- Each installation has one random ID. The server keeps one row per ID and updates it in place. It doesn't keep a check-in history for each ID.
- If a check-in arrives within 20 hours (configurable) of the last accepted one, the server acknowledges it but doesn't count it. Retries and duplicates therefore don't inflate the numbers.
- Daily series: if an ID's previous check-in was on an earlier UTC day, that day's counter goes up by one. Monthly series work the same way per UTC month. An installation is counted at most once a day and once a month.
- Time windows use the server clock. Client clocks are never sent or trusted.
- Version, Android and variant breakdowns cover installations active in the last 30 days. Each installation is counted under its most recent report.
- Download history is a daily snapshot of the running GitHub total. The service takes it when it refreshes its cached GitHub data, so a day with no visits to the statistics endpoint may have no snapshot.

## Small groups

A breakdown is published only when at least `MIN_GROUP_SIZE` (default 10) installations are active. Groups smaller than that are combined into "Other".

If "Other" is itself smaller than the minimum, the next-smallest group is added to it. Otherwise someone could subtract the published groups from the total and work out the size of a small group. Installations with no country are shown as "Country not shared".

## Limitations

- **Self-selection:** people who opt in are not the same as all users. Countries with many privacy-minded users may be under-represented.
- **No identity checks:** a person can reset their ID or script fake check-ins. Rate limits and an hourly cap on new installations reduce the damage but can't remove it.
- **Reinstalls and cleared app data** create a new ID. The old ID stays counted until it ages out.
- **Country** is whatever the user picked. It isn't verified.
- **Past days don't change when a record is deleted**, because aggregates can't be traced to a record.
- **GitHub download counts** include repeat downloads and can't be tied to installations.
