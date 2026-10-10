// Timezone helpers built on the Intl API (no dependencies).
// All "instants" are epoch milliseconds; dates are "YYYY-MM-DD" strings.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const partsFormatters = new Map();

function getPartsFormatter(timeZone) {
  if (!partsFormatters.has(timeZone)) {
    partsFormatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }
  return partsFormatters.get(timeZone);
}

/** UTC offset of `timeZone` at instant `ms`, in minutes (e.g. +60 for UTC+1). */
export function tzOffset(timeZone, ms) {
  const p = Object.fromEntries(
    getPartsFormatter(timeZone)
      .formatToParts(ms)
      .map(({ type, value }) => [type, value])
  );
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / MINUTE);
}

/** Convert a wall-clock time ("05:30") on `date` in `timeZone` to an instant. DST-aware. */
export function zonedToInstant(date, hhmm, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  // Two passes so the offset used is the one in effect at the resulting instant.
  const guess = wall - tzOffset(timeZone, wall) * MINUTE;
  return wall - tzOffset(timeZone, guess) * MINUTE;
}

export function addDays(date, n) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Today's date ("YYYY-MM-DD") as seen in `timeZone`. */
export function todayIn(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(Date.now());
}

const timeFormatters = new Map();

export function formatTime(ms, timeZone) {
  if (!timeFormatters.has(timeZone)) {
    timeFormatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })
    );
  }
  return timeFormatters.get(timeZone).format(ms);
}

/** "UTC+05:30" style label for `timeZone` at instant `ms`. */
export function formatOffset(timeZone, ms) {
  const off = tzOffset(timeZone, ms);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

/** The [start, end) instants of `date` in `timeZone` (23/24/25h long depending on DST). */
export function dayWindow(date, timeZone) {
  return {
    start: zonedToInstant(date, '00:00', timeZone),
    end: zonedToInstant(addDays(date, 1), '00:00', timeZone),
  };
}

/** Hour tick marks across the display day. */
export function hourTicks(date, timeZone) {
  const { start, end } = dayWindow(date, timeZone);
  const ticks = [];
  for (let t = start; t <= end; t += HOUR) {
    ticks.push({ at: t, pos: (t - start) / (end - start), label: formatTime(t, timeZone) });
  }
  return ticks;
}

/**
 * Project prayer blocks given in a country's local time onto the display day
 * of `displayTimeZone`.
 *
 * `times` is [["05:00", "05:30"], ...] in `sourceTimeZone` local time. An end
 * earlier than its start is treated as ending the next day (e.g. Isha → 00:30).
 *
 * The same schedule is applied to the source's previous and next day as well,
 * so that blocks which fall outside the display day after shifting (large
 * offsets) wrap around instead of disappearing. Blocks are clipped to the
 * display day; `pos`/`width` are fractions (0–1) of the display day.
 */
export function projectBlocks(times, sourceTimeZone, date, displayTimeZone) {
  const win = dayWindow(date, displayTimeZone);
  const span = win.end - win.start;
  const blocks = [];

  for (const dayShift of [-1, 0, 1]) {
    const sourceDate = addDays(date, dayShift);
    times.forEach(([s, e], index) => {
      const start = zonedToInstant(sourceDate, s, sourceTimeZone);
      let end = zonedToInstant(sourceDate, e, sourceTimeZone);
      if (end <= start) end = zonedToInstant(addDays(sourceDate, 1), e, sourceTimeZone);

      const clipStart = Math.max(start, win.start);
      const clipEnd = Math.min(end, win.end);
      if (clipEnd <= clipStart) return;

      blocks.push({
        key: `${sourceDate}-${index}`,
        index,
        sourceDate,
        start,
        end,
        pos: (clipStart - win.start) / span,
        width: (clipEnd - clipStart) / span,
        clippedStart: start < win.start,
        clippedEnd: end > win.end,
      });
    });
  }

  return blocks.sort((a, b) => a.pos - b.pos);
}

/**
 * Free time between projected blocks on the display day: the complement of
 * the (possibly overlapping) blocks within the day window.
 */
export function freeGaps(blocks, date, displayTimeZone) {
  const win = dayWindow(date, displayTimeZone);
  const span = win.end - win.start;
  const gaps = [];
  let cursor = win.start;

  const busy = blocks
    .map((b) => [Math.max(b.start, win.start), Math.min(b.end, win.end)])
    .sort((a, b) => a[0] - b[0]);

  for (const [start, end] of [...busy, [win.end, win.end]]) {
    if (start > cursor) {
      gaps.push({ start: cursor, end: start, pos: (cursor - win.start) / span, width: (start - cursor) / span });
    }
    cursor = Math.max(cursor, end);
  }
  return gaps;
}

export function formatDuration(ms) {
  const total = Math.round(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
