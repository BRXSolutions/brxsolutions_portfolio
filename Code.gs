/**
 * Booking backend for the portfolio booking page.
 * Runs as workwithbrix@gmail.com (Google Apps Script web app).
 *
 *  GET  → returns open time slots, based on your Google Calendar free/busy
 *  POST → books a slot: creates the event with a Google Meet link and
 *         sends the calendar invitation to the guest by email
 *
 * Setup: see README.md ("Booking system setup").
 */

const CONFIG = {
  CALENDAR_ID: 'primary',            // primary calendar of the account running the script
  TIMEZONE: 'Asia/Manila',           // your working timezone
  UTC_OFFSET: '+08:00',              // must match TIMEZONE (Manila has no daylight saving)
  WORK_DAYS: [1, 2, 3, 4, 5],        // 1 = Mon … 7 = Sun
  START_HOUR: 9,                     // first slot starts at 9:00
  END_HOUR: 17,                      // last slot ends by 17:00
  SLOT_MINUTES: 30,                  // meeting length
  BUFFER_MINUTES: 0,                 // gap kept before/after your existing events
  DAYS_AHEAD: 21,                    // how far ahead people can book
  MIN_NOTICE_HOURS: 12,              // no bookings sooner than this
  MEETING_TITLE: 'Discovery call with Brix',
};

/** Run this once from the editor to grant permissions. */
function setup() {
  const a = getAvailability_();
  Logger.log('Open days found: ' + Object.keys(a.days).length);
}

function doGet() {
  try {
    return json_(getAvailability_());
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Could not load availability.' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json_({ ok: false, error: 'Busy right now — please try again in a moment.' });
  }
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    // Honeypot: real visitors never fill this hidden field
    if (data.website) return json_({ ok: true });

    const name = String(data.name || '').trim().slice(0, 100);
    const email = String(data.email || '').trim().slice(0, 200);
    const notes = String(data.notes || '').trim().slice(0, 1000);
    const startIso = String(data.start || '');

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: 'Please enter your name and a valid email.' });
    }

    // Re-check the slot is still open (prevents double booking)
    const avail = getAvailability_();
    const stillOpen = Object.values(avail.days).some(list => list.indexOf(startIso) !== -1);
    if (!stillOpen) {
      return json_({ ok: false, refresh: true, error: 'Sorry, that time was just taken. Please pick another slot.' });
    }

    const start = new Date(startIso);
    const end = new Date(start.getTime() + CONFIG.SLOT_MINUTES * 60000);

    const event = Calendar.Events.insert({
      summary: CONFIG.MEETING_TITLE + ' — ' + name,
      description: (notes ? 'Notes from ' + name + ':\n' + notes + '\n\n' : '') + 'Booked via portfolio site.',
      start: { dateTime: start.toISOString(), timeZone: CONFIG.TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: CONFIG.TIMEZONE },
      attendees: [{ email: email, displayName: name }],
      conferenceData: {
        createRequest: {
          requestId: Utilities.getUuid(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: true },
    }, CONFIG.CALENDAR_ID, { conferenceDataVersion: 1, sendUpdates: 'all' });

    return json_({ ok: true, start: start.toISOString(), end: end.toISOString(), meetLink: event.hangoutLink || '' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}

function getAvailability_() {
  const TZ = CONFIG.TIMEZONE;
  const now = new Date();
  const earliest = new Date(now.getTime() + CONFIG.MIN_NOTICE_HOURS * 3600000);
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const rangeStart = new Date(today + 'T00:00:00' + CONFIG.UTC_OFFSET);
  const rangeEnd = new Date(rangeStart.getTime() + (CONFIG.DAYS_AHEAD + 1) * 86400000);
  const busy = getBusy_(rangeStart, rangeEnd);
  const buffer = CONFIG.BUFFER_MINUTES * 60000;

  const days = {};
  for (let d = 0; d <= CONFIG.DAYS_AHEAD; d++) {
    const dayStart = new Date(rangeStart.getTime() + d * 86400000);
    const weekday = Number(Utilities.formatDate(dayStart, TZ, 'u')); // 1 = Mon … 7 = Sun
    if (CONFIG.WORK_DAYS.indexOf(weekday) === -1) continue;

    const slots = [];
    for (let m = CONFIG.START_HOUR * 60; m + CONFIG.SLOT_MINUTES <= CONFIG.END_HOUR * 60; m += CONFIG.SLOT_MINUTES) {
      const s = new Date(dayStart.getTime() + m * 60000);
      const e = new Date(s.getTime() + CONFIG.SLOT_MINUTES * 60000);
      if (s < earliest) continue;
      const clash = busy.some(b => s.getTime() < b.end + buffer && e.getTime() > b.start - buffer);
      if (!clash) slots.push(s.toISOString());
    }
    if (slots.length) days[Utilities.formatDate(dayStart, TZ, 'yyyy-MM-dd')] = slots;
  }
  return { ok: true, timezone: TZ, slotMinutes: CONFIG.SLOT_MINUTES, days: days };
}

function getBusy_(start, end) {
  const res = Calendar.Freebusy.query({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    items: [{ id: CONFIG.CALENDAR_ID }],
  });
  const cal = Object.values(res.calendars || {})[0] || {};
  return (cal.busy || []).map(b => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
