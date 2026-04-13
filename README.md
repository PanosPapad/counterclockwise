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
4. Edit the `CONFIG` section at the top of the script:
   - Set `COMPANY_DOMAIN` to your company's email domain
   - Optionally add known group emails to `GROUP_EMAILS`
   - Optionally add custom room patterns to `ROOM_EMAIL_PATTERNS`
5. Test it:
   - Set `DRY_RUN` to `true`
   - Select `updateMeetingColors` from the function dropdown and click **Run**
   - Check the execution log to see what would change
6. When satisfied, set `DRY_RUN` back to `false`
7. Run `createHourlyTrigger` once to set up automatic hourly execution

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
