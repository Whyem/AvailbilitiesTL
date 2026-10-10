import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dayWindow, formatDuration, formatOffset, formatTime, freeGaps, projectBlocks } from './time.js';

const DEFAULT_NAMES = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
const NO_NIGHT = [];

/**
 * One country's row.
 *
 * Props:
 *   label            – row title, e.g. "Morocco"
 *   times            – [["05:00","05:30"], ...] in the country's local time
 *   timeZone         – IANA zone of the country, e.g. "Africa/Casablanca"
 *   date             – "YYYY-MM-DD" day being displayed (in displayTimeZone)
 *   displayTimeZone  – zone of the shared horizontal axis
 *   names            – optional block names (defaults to the 5 daily prayers)
 *   now              – optional instant (ms) to draw a "now" marker
 *   error            – optional message shown in place of the blocks
 *   hoverAt          – optional instant under the mouse; shows local time and busy/free there
 *   night            – optional [["18:32","07:15"]] (maghrib → sunrise) shaded as night
 *
 * The gaps between blocks are shown as free time (label shown when wide enough).
 */
export default function Timeline({
  label,
  times,
  timeZone,
  date,
  displayTimeZone,
  names = DEFAULT_NAMES,
  now,
  error,
  hoverAt,
  night = NO_NIGHT,
}) {
  const blocks = useMemo(
    () => projectBlocks(times, timeZone, date, displayTimeZone),
    [times, timeZone, date, displayTimeZone]
  );

  const gaps = useMemo(
    () => (error ? [] : freeGaps(blocks, date, displayTimeZone)),
    [error, blocks, date, displayTimeZone]
  );

  const nightBands = useMemo(
    () => projectBlocks(night, timeZone, date, displayTimeZone),
    [night, timeZone, date, displayTimeZone]
  );

  const trackRef = useRef(null);
  const trackWidth = useElementWidth(trackRef);

  const reference = blocks[0]?.start ?? Date.now();
  // "Morocco (Casablanca)" → country + city
  const [, country = label, city] = label.match(/^(.*?)\s*\((.*)\)$/) ?? [];

  return (
    <div className="timeline">
      <div className="timeline-label">
        <strong>{country}</strong>
        <span className="tz">
          {city ? `${city} · ` : ''}
          {formatOffset(timeZone, reference)}
        </span>
      </div>

      <div className="timeline-track" ref={trackRef}>
        {nightBands.map((n) => (
          <div
            key={n.key}
            className={`night${n.pos === 0 ? ' at-start' : ''}${n.pos + n.width > 0.999 ? ' at-end' : ''}`}
            style={{ left: `${n.pos * 100}%`, width: `${n.width * 100}%` }}
          />
        ))}
        {error && <span className="track-error">{error}</span>}
        {gaps.map((g) => {
          const range = `${formatTime(g.start, displayTimeZone)}–${formatTime(g.end, displayTimeZone)}`;
          const duration = formatDuration(g.end - g.start);
          return (
            <div
              key={g.start}
              className="gap"
              style={{ left: `${g.pos * 100}%`, width: `${g.width * 100}%` }}
              title={`Free ${duration}\n${range} ${displayTimeZone}`}
            >
              {g.width * trackWidth > duration.length * 7 + 20 && <span className="gap-label">{duration}</span>}
            </div>
          );
        })}
        {blocks.map((b) => {
          const name = names[b.index] ?? `#${b.index + 1}`;
          const local = `${formatTime(b.start, timeZone)}–${formatTime(b.end, timeZone)}`;
          const shown = `${formatTime(b.start, displayTimeZone)}–${formatTime(b.end, displayTimeZone)}`;
          const classes = [
            'block',
            `block-${b.index % 5}`,
            b.clippedStart && 'clipped-start',
            b.clippedEnd && 'clipped-end',
          ]
            .filter(Boolean)
            .join(' ');
          // Names run horizontally when they fit, otherwise vertically.
          const horizontal = b.width * trackWidth >= name.length * 7 + 16;

          return (
            <div
              key={b.key}
              className={classes}
              style={{ left: `${b.pos * 100}%`, width: `${b.width * 100}%` }}
              title={`${name}\n${local} local (${b.sourceDate})\n${shown} ${displayTimeZone}`}
            >
              <span lang="ar" className={`block-name${horizontal ? '' : ' vertical'}`}>{name}</span>
            </div>
          );
        })}

        {now != null && <NowMarker now={now} date={date} displayTimeZone={displayTimeZone} />}
        {hoverAt != null && !error && (
          <HoverBadge at={hoverAt} blocks={blocks} names={names} {...{ date, timeZone, displayTimeZone }} />
        )}
      </div>
    </div>
  );
}

function NowMarker({ now, date, displayTimeZone }) {
  const { start, end } = dayWindow(date, displayTimeZone);
  if (now < start || now > end) return null;
  const pos = (now - start) / (end - start);
  return <div className="now-marker" style={{ left: `${pos * 100}%` }} />;
}

function HoverBadge({ at, blocks, names, date, timeZone, displayTimeZone }) {
  const { start, end } = dayWindow(date, displayTimeZone);
  const pos = (at - start) / (end - start);
  const block = blocks.find((b) => b.start <= at && at < b.end);
  const status = block ? names[block.index] ?? `#${block.index + 1}` : 'free';
  return (
    <span
      className={`hover-badge${block ? ' busy' : ''}${pos > 0.85 ? ' flip' : ''}`}
      style={{ left: `${pos * 100}%` }}
    >
      {formatTime(at, timeZone)} · {status}
    </span>
  );
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
