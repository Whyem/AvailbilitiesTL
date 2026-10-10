import { useEffect, useMemo, useRef, useState } from 'react';
import BlockSettings, { NAMES, PRAYERS, toBlocks, useBlockSettings } from './BlockSettings.jsx';
import Timeline from './Timeline.jsx';
import { addDays, dayWindow, formatDuration, formatTime, hourTicks, todayIn, zonedToInstant } from './time.js';

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function App() {
  const [displayTimeZone, setDisplayTimeZone] = useState(BROWSER_TZ);
  const [settings, setSettings] = useBlockSettings();
  const now = useNow(30_000);
  // Always today in the axis timezone; re-evaluated each tick so it rolls over at midnight.
  const date = todayIn(displayTimeZone);
  const { data, error, loading } = usePrayers(date);
  const sectionRef = useRef(null);
  const axisRef = useRef(null);
  const [hover, setHover] = useState(null); // { x: px within section, at: instant }

  const onPointerMove = (e) => {
    const track = axisRef.current.getBoundingClientRect();
    const section = sectionRef.current.getBoundingClientRect();
    const f = (e.clientX - track.left) / track.width;
    if (f < 0 || f > 1) return setHover(null);
    const { start, end } = dayWindow(date, displayTimeZone);
    setHover({ x: e.clientX - section.left, at: start + f * (end - start) });
  };

  const countries = data?.countries ?? [];
  const rows = useMemo(
    () =>
      countries.map((c) => ({
        ...c,
        times: c.prayers ? toBlocks(c.prayers, settings) : [],
        night: c.prayers ? [[c.prayers.maghrib, c.prayers.sunrise]] : [],
      })),
    [countries, settings]
  );

  const displayZones = [...new Set([BROWSER_TZ, 'UTC', ...countries.map((c) => c.timeZone)])];
  const ticks = hourTicks(date, displayTimeZone);

  return (
    <main className="app">
      <header className="hero">
        <div className="hero-main">
          <span className="eyebrow" lang="ar">
            مواقيت الصلاة
          </span>
          <h1>Prayer Timelines</h1>
          <p className="hero-date">
            {formatLongDate(now, displayTimeZone)}
            <span className="dot">·</span>
            <span lang="ar">{formatHijri(now, displayTimeZone)}</span>
          </p>
        </div>

        <div className="hero-side">
          <div className="clock">
            <span className="clock-time">{formatTime(now, displayTimeZone)}</span>
            <span className="clock-zone">{displayTimeZone}</span>
          </div>
          <ul className="next-list">
            {rows
              .filter((r) => r.prayers)
              .map((r) => {
                const next = nextPrayer(r, now);
                return (
                  <li key={r.id} className="next">
                    <span className="next-country">{r.label.replace(/\s*\(.*\)$/, '')}</span>
                    <span className={`next-name p-${next.index}`} lang="ar">
                      {NAMES[next.index]}
                    </span>
                    <span className="next-in">
                      {formatTime(next.at, r.timeZone)} · in {formatDuration(next.at - now)}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      </header>

      {error && <p className="error">Could not load prayer times: {error}</p>}

      <section className="card">
        <div className="toolbar">
          <h2>Today's schedule</h2>
          <label className="select">
            <span>Timezone</span>
            <select value={displayTimeZone} onChange={(e) => setDisplayTimeZone(e.target.value)}>
              {displayZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz === BROWSER_TZ ? `${tz} (yours)` : tz}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          className="timelines"
          aria-busy={loading}
          ref={sectionRef}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <div className="timeline axis">
            <div className="timeline-label" />
            <div className="axis-track" ref={axisRef}>
              {ticks.map((t, i) => (
                <span
                  key={t.at}
                  className="tick"
                  style={{ left: `${t.pos * 100}%` }}
                  data-minor={i % 6 !== 0 || undefined}
                >
                  {i % 3 === 0 ? t.label : ''}
                </span>
              ))}
            </div>
          </div>

          {loading && !rows.length && <p className="loading">Loading prayer times…</p>}

          {rows.map((c) => (
            <Timeline
              key={c.id}
              label={c.label}
              timeZone={c.timeZone}
              times={c.times}
              night={c.night}
              names={NAMES}
              date={date}
              displayTimeZone={displayTimeZone}
              now={now}
              error={c.error}
              hoverAt={hover?.at}
            />
          ))}

          {hover && (
            <div className="cursor-line" style={{ left: hover.x }}>
              <span className="cursor-label">{formatTime(hover.at, displayTimeZone)}</span>
            </div>
          )}
        </div>

        <ul className="legend">
          <li>
            <span className="key key-busy" /> Prayer (busy)
          </li>
          <li>
            <span className="key key-free" /> Free time
          </li>
          <li>
            <span className="key key-night" /> Night (maghrib → sunrise)
          </li>
          <li>
            <span className="key key-now" /> Now
          </li>
        </ul>
      </section>

      <BlockSettings settings={settings} onChange={setSettings} />
    </main>
  );
}

/** Next adhan after `now` for a row (today's times reused for tomorrow's Fajr). */
function nextPrayer(row, now) {
  const today = todayIn(row.timeZone);
  for (const day of [today, addDays(today, 1)]) {
    for (const [index, p] of PRAYERS.entries()) {
      const at = zonedToInstant(day, row.prayers[p], row.timeZone);
      if (at > now) return { index, at };
    }
  }
}

function formatLongDate(ms, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
}

function formatHijri(ms, timeZone) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ms);
}

// In dev the data comes from the local API (npm run server). The production
// build is static (GitHub Pages): a scheduled workflow publishes data/<date>.json
// next to the site, with data/latest.json as a fallback.
async function fetchPrayers(date, signal) {
  const get = async (url) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  if (import.meta.env.DEV) return get(`/api/prayers?date=${date}`);
  const base = import.meta.env.BASE_URL;
  try {
    return await get(`${base}data/${date}.json`);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return get(`${base}data/latest.json`);
  }
}

function usePrayers(date) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchPrayers(date, ctrl.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ data: null, error: err.message, loading: false });
      });
    return () => ctrl.abort();
  }, [date]);
  return state;
}

function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
