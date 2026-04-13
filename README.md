# Counterclockwise

Auto-color your Google Calendar events by meeting type. A DIY replacement for [Clockwise's](https://getclockwise.com/) color-coding feature (RIP).

## What it does

Runs hourly via Google Apps Script and colors your calendar events based on rules:

| Category   | Color     | Rule                                      |
|------------|-----------|-------------------------------------------|
| Focus Time | Graphite  | Google focus time events or title keywords |
| External   | Peacock   | Any attendee outside your company domain   |
| Block      | Blueberry | Only yourself, no other attendees          |
| 1-on-1     | Basil     | Recurring, exactly 2 people                |
| Weekly     | Flamingo  | Recurring, more than 2 people              |
| Coffee     | Grape     | One-off, exactly 2 people                  |
| Ad-hoc     | Sage      | One-off, more than 2 people                |
| Default    | Lavender  | Fallback                                   |

Rules are evaluated top-to-bottom. Focus time always wins.

## Setup

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Replace the contents of `Code.gs` with the script from this repo
3. Enable the Calendar Advanced Service:
   - Click the **+** next to "Services" in the left sidebar
   - Select **Google Calendar API** (v3) and click **Add**
4. Edit the `CONFIG` section at the top of the script (see [Configuration](#configuration) below)
5. Test it:
   - Set `DRY_RUN` to `true`
   - Select `updateMeetingColors` from the function dropdown and click **Run**
   - Check the execution log to see what would change
6. When satisfied, set `DRY_RUN` back to `false`
7. Run `createHourlyTrigger` once to set up automatic hourly execution

## Configuration

Edit the `CONFIG` object at the top of `Code.gs`:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `COMPANY_DOMAIN` | No | `""` | Your company's email domain. Leave empty for personal Gmail — external meeting detection will be disabled. |
| `LOOK_AHEAD_DAYS` | No | `14` | How many days ahead to scan for events. |
| `DRY_RUN` | No | `false` | When `true`, logs what would change without actually updating colors. |
| `GROUP_EMAILS` | No | `[]` | Known Google Group or distribution list emails. These count as 2+ attendees so group meetings are classified correctly. Leave empty if unsure. |
| `ROOM_EMAIL_PATTERNS` | No | Google Workspace default | Email patterns for room/resource calendars, excluded from attendee counts. |

### Example: Work calendar

```js
const CONFIG = {
  LOOK_AHEAD_DAYS: 14,
  COMPANY_DOMAIN: "yourcompany.com",
  DRY_RUN: false,
  GROUP_EMAILS: [
    "engineering@yourcompany.com",
    "design@yourcompany.com",
  ],
  ROOM_EMAIL_PATTERNS: [
    "resource.calendar.google.com",
  ],
};
```

### Example: Personal Gmail

```js
const CONFIG = {
  LOOK_AHEAD_DAYS: 14,
  COMPANY_DOMAIN: "",    // No domain — external detection is disabled
  DRY_RUN: false,
  GROUP_EMAILS: [],
  ROOM_EMAIL_PATTERNS: [
    "resource.calendar.google.com",
  ],
};
```

> **Note:** Without a company domain, all meetings are classified purely by attendee count and recurrence. The "External" color will never be applied.

## Customizing colors

Edit the `COLORS` object in the script. Available Google Calendar color IDs:

| ID | Color     |
|----|-----------|
| 1  | Lavender  |
| 2  | Sage      |
| 3  | Grape     |
| 4  | Flamingo  |
| 5  | Banana    |
| 6  | Tangerine |
| 7  | Peacock   |
| 8  | Graphite  |
| 9  | Blueberry |
| 10 | Basil     |
| 11 | Tomato    |

## How it works

- Skips all-day events and declined events
- Uses the Google Calendar Advanced API to detect focus time events and hidden guest lists
- Falls back to title keyword matching if the advanced API is unavailable
- Counts Google Groups as 2+ attendees (if configured) so they trigger meeting colors
- Excludes room/resource calendars from attendee counts
- Only updates events whose color actually needs to change (avoids unnecessary API calls)

## License

MIT
