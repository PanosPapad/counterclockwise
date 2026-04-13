/**
 * Counterclockwise — Google Calendar Meeting Colorizer
 *
 * Automatically colors calendar events based on meeting type:
 *   - Focus Time  (Graphite)  — Google focus time events, or title matches keywords
 *   - External    (Peacock)   — Any attendee outside your company domain
 *   - Block       (Blueberry) — Only yourself, no other attendees
 *   - 1-on-1      (Basil)     — Recurring, exactly 2 people
 *   - Weekly      (Flamingo)  — Recurring, more than 2 people
 *   - Coffee      (Grape)     — One-off, exactly 2 people
 *   - Ad-hoc      (Sage)      — One-off, more than 2 people
 *   - Default     (Lavender)  — Fallback
 *
 * Setup:
 *   1. Open your Google Apps Script project (script.google.com)
 *   2. Go to Services (+ icon) and add "Google Calendar API" (v3)
 *   3. Edit the CONFIG section below to match your organization
 *   4. Run createHourlyTrigger() once to enable automatic updates
 *   5. Optionally set DRY_RUN to true first to preview changes in the logs
 */

// ─── Configuration ──────────────────────────────────────────────────────────────
const CONFIG = {
  LOOK_AHEAD_DAYS: 14,
  COMPANY_DOMAIN: "yourcompany.com",      // Change to your company's email domain
  DRY_RUN: false,                          // Set to true to preview without applying

  // Emails of Google Groups or distribution lists in your org.
  // These are counted as 2+ attendees instead of 1.
  // Leave empty if unsure — each guest will simply count as 1.
  GROUP_EMAILS: [
    // "engineering@yourcompany.com",
    // "design@yourcompany.com",
  ],

  // Email patterns that identify room/resource calendars (excluded from guest counts)
  ROOM_EMAIL_PATTERNS: [
    "resource.calendar.google.com",        // Default Google Workspace rooms
    // Add custom patterns for your org, e.g.:
    // "room@yourcompany.com",
  ],
};

// ─── Color Mapping ──────────────────────────────────────────────────────────────
// Google Calendar color IDs:
// 1=Lavender  2=Sage      3=Grape     4=Flamingo  5=Banana
// 6=Tangerine 7=Peacock   8=Graphite  9=Blueberry 10=Basil  11=Tomato
const COLORS = {
  FOCUS_TIME: "8",  // Graphite
  EXTERNAL: "7",    // Peacock
  BLOCK: "9",       // Blueberry
  ONE_ON_ONE: "10", // Basil
  WEEKLY: "4",      // Flamingo
  COFFEE: "3",      // Grape
  AD_HOC: "2",      // Sage
  DEFAULT: "1",     // Lavender
};

// Title keywords that identify focus time (fallback when Calendar API type is unavailable)
const FOCUS_TIME_KEYWORDS = ["focus time", "focus block", "deep work", "no meeting"];

// ─── Main ───────────────────────────────────────────────────────────────────────

/**
 * Main function — processes upcoming events and applies color rules.
 * Triggered hourly via createHourlyTrigger().
 */
function updateMeetingColors() {
  const calendar = CalendarApp.getDefaultCalendar();
  const calendarId = calendar.getId();
  const now = new Date();
  const lookAheadEnd = new Date(now.getTime() + CONFIG.LOOK_AHEAD_DAYS * 24 * 60 * 60 * 1000);

  Logger.log(`Checking events from ${now} to ${lookAheadEnd}`);
  if (CONFIG.DRY_RUN) {
    Logger.log("DRY RUN enabled — no colors will be changed");
  }

  const events = calendar.getEvents(now, lookAheadEnd);
  Logger.log(`Found ${events.length} events`);

  events.forEach((event) => {
    try {
      if (event.isAllDayEvent()) return;

      // Skip events the user has declined
      if (event.getMyStatus() === CalendarApp.GuestStatus.NO) {
        Logger.log(`Skipping declined event: "${event.getTitle()}"`);
        return;
      }

      // Fetch the advanced event once and reuse across checks
      const advancedEvent = getAdvancedEvent(event, calendarId);
      const newColor = determineEventColor(event, advancedEvent);
      const currentColor = event.getColor();

      if (currentColor !== newColor) {
        Logger.log(`${CONFIG.DRY_RUN ? "[DRY RUN] Would update" : "Updating"} "${event.getTitle()}": ${currentColor} → ${newColor}`);
        if (!CONFIG.DRY_RUN) {
          event.setColor(newColor);
        }
      }
    } catch (error) {
      Logger.log(`Error processing event "${event.getTitle()}": ${error}`);
    }
  });
}

// ─── Color Rules ────────────────────────────────────────────────────────────────

/**
 * Determines the appropriate color for an event.
 * Rules are checked in priority order (highest priority first).
 */
function determineEventColor(event, advancedEvent) {
  const guests = getGuestsExcludingRooms(event);
  const isFocusTime = checkIsFocusTime(event, advancedEvent);
  const hasExternalGuests = checkHasExternalGuests(guests);

  // If guest list is hidden, treat as a large recurring meeting
  if (advancedEvent && advancedEvent.guestsCanSeeOtherGuests === false) {
    logEventDetails(event, guests, "hidden", event.isRecurringEvent(), isFocusTime, hasExternalGuests);
    if (isFocusTime) return COLORS.FOCUS_TIME;
    if (hasExternalGuests) return COLORS.EXTERNAL;
    return COLORS.WEEKLY;
  }

  const totalAttendees = countTotalAttendees(guests);
  const isRecurring = event.isRecurringEvent();

  logEventDetails(event, guests, totalAttendees, isRecurring, isFocusTime, hasExternalGuests);

  // Rule 1: Focus time
  if (isFocusTime) return COLORS.FOCUS_TIME;

  // Rule 2: External meetings
  if (hasExternalGuests) return COLORS.EXTERNAL;

  // Rule 3: Only myself (blocks)
  if (totalAttendees === 1) return COLORS.BLOCK;

  // Rule 4: 1-on-1s (recurring, exactly 2 people)
  if (isRecurring && totalAttendees === 2) return COLORS.ONE_ON_ONE;

  // Rule 5: Weekly meetings (recurring, more than 2 people)
  if (isRecurring && totalAttendees > 2) return COLORS.WEEKLY;

  // Rule 6: Coffee (one-off, exactly 2 people)
  if (!isRecurring && totalAttendees === 2) return COLORS.COFFEE;

  // Rule 7: Ad-hoc (one-off, more than 2 people)
  if (!isRecurring && totalAttendees > 2) return COLORS.AD_HOC;

  return COLORS.DEFAULT;
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Fetches the event from the Advanced Calendar API (v3).
 * Returns null if the service is unavailable.
 */
function getAdvancedEvent(event, calendarId) {
  try {
    const eventId = event.getId().replace("@google.com", "");
    return Calendar.Events.get(calendarId, eventId);
  } catch (error) {
    Logger.log(`Could not fetch advanced event for "${event.getTitle()}": ${error}`);
    return null;
  }
}

/**
 * Returns the guest list excluding room/resource calendars.
 */
function getGuestsExcludingRooms(event) {
  return event.getGuestList().filter((guest) => !isRoom(guest.getEmail()));
}

/**
 * Checks whether an email belongs to a room or resource calendar.
 */
function isRoom(email) {
  email = email.toLowerCase();
  return CONFIG.ROOM_EMAIL_PATTERNS.some((pattern) => email.includes(pattern));
}

/**
 * Counts total attendees (guests + calendar owner).
 * Configured group emails count as 2 to ensure they are treated as meetings.
 */
function countTotalAttendees(guests) {
  const guestCount = guests.reduce((sum, guest) => {
    const email = guest.getEmail().toLowerCase();
    const isGroup = CONFIG.GROUP_EMAILS.some((g) => g.toLowerCase() === email);
    return sum + (isGroup ? 2 : 1);
  }, 0);
  return guestCount + 1; // +1 for the calendar owner
}

/**
 * Checks if an event is focus time via the Calendar API, with a title-based fallback.
 */
function checkIsFocusTime(event, advancedEvent) {
  if (advancedEvent && advancedEvent.eventType === "focusTime") {
    return true;
  }
  const title = event.getTitle().toLowerCase();
  return FOCUS_TIME_KEYWORDS.some((keyword) => title.includes(keyword));
}

/**
 * Checks if any guest has an email address outside the company domain.
 */
function checkHasExternalGuests(guests) {
  return guests.some((guest) => {
    const email = guest.getEmail().toLowerCase();
    return !email.endsWith(`@${CONFIG.COMPANY_DOMAIN}`);
  });
}

/**
 * Logs event details for debugging.
 */
function logEventDetails(event, guests, totalAttendees, isRecurring, isFocusTime, hasExternalGuests) {
  Logger.log(
    `Event: "${event.getTitle()}" | ` +
    `Attendees: ${totalAttendees} | ` +
    `Recurring: ${isRecurring} | ` +
    `Focus: ${isFocusTime} | ` +
    `External: ${hasExternalGuests}`
  );
}

// ─── Trigger Setup ──────────────────────────────────────────────────────────────

/**
 * Creates a time-based trigger to run updateMeetingColors every hour.
 * Run this function once manually to set up the trigger.
 */
function createHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "updateMeetingColors")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("updateMeetingColors")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("Hourly trigger created for updateMeetingColors");
}
