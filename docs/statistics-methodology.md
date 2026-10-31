# Statistics methodology

## Definitions

| Metric                       | Definition                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release downloads            | Sum of `download_count` of `.apk` assets across non-draft GitHub releases. HTTP downloads, including repeats, mirrors and bots. **Not users or devices.** |
| Daily active installations   | Opted-in installations whose last accepted check-in was within the previous 24 hours.                                                                     |
| Weekly active installations  | …within the previous 7 days.                                                                                                                              |
| Monthly active installations | …within the previous 30 days.                                                                                                                             |
| Estimated active             | Reported as the monthly figure.                                                                                                                           |

Nothing here is "total installations" or "total users". Every installation figure is a **lower bound**: only people who opt in are counted.

## Counting

- Each installation has one random ID. The server keeps one row per ID and updates it; it never stores a check-in history per ID.
- A check-in within 20 hours (configurable) of the previous accepted one is acknowledged but not counted, so retries and duplicates do not inflate anything.
- Daily series: when an ID's previous check-in was on an earlier UTC day, that day's counter increases by one. Monthly series work the same way per UTC month, so an installation is counted at most once per day and once per month.
- Windows use the server clock. Client clocks are never trusted or sent.
- Version, Android and variant breakdowns cover installations active in the last 30 days, using each one's most recent report.
- Download history is a daily snapshot of the cumulative GitHub total. It is taken when the service refreshes the cached GitHub data, so days without any visit to the statistics endpoint may have no snapshot.

## Small-group suppression

A breakdown is published only when at least `MIN_GROUP_SIZE` (default 10) installations are active. Groups smaller than that fold into "Other". If the folded remainder is itself smaller than the threshold, the next-smallest group joins it so the remainder cannot reveal a small group by subtraction. Installations without a country appear as "Country not shared".

## Limitations

- **Self-selection:** volunteers differ from all users. Countries with privacy-conscious users may be under-represented.
- **No identity verification:** a person can reset their ID or script fake check-ins. Rate limiting and an hourly new-installation cap bound the damage but cannot eliminate it.
- **Reinstalls and cleared app data** create new IDs, and the old one stays counted until it ages out.
- **Self-declared country** is not verified.
- Aggregates for past days are not changed when a record is deleted, because they cannot be attributed to a record.
- GitHub download counts include repeated downloads and cannot be tied to installations.
