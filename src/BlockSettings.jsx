import { useEffect, useState } from 'react';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const NAMES = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
const LATIN_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Per prayer, in minutes: wait from adhan until salat (e.g. iqama), salat length,
// and extra time kept busy after the salat. The busy block runs from the adhan
// to the end of all three.
export const DEFAULT_SETTINGS = {
  fajr: { offset: 20, duration: 12, after: 25 },
  dhuhr: { offset: 20, duration: 12, after: 0 },
  asr: { offset: 20, duration: 12, after: 0 },
  maghrib: { offset: 20, duration: 12, after: 0 },
  isha: { offset: 20, duration: 12, after: 0 },
};

const FIELDS = [
  { key: 'offset', label: 'Before salat', min: 0 },
  { key: 'duration', label: 'Salat', min: 1 },
  { key: 'after', label: 'After salat', min: 0 },
];

export const blockLength = ({ offset, duration, after }) => offset + duration + after;

const STORAGE_KEY = 'prayer-block-settings';

/** Block settings state, remembered in this browser between visits. */
export function useBlockSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      // Merge per prayer so settings saved before a field existed get its default.
      if (saved) {
        return Object.fromEntries(PRAYERS.map((p) => [p, { ...DEFAULT_SETTINGS[p], ...saved[p] }]));
      }
    } catch {
      // Storage unavailable or corrupt: fall back to defaults.
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore: settings just won't persist.
    }
  }, [settings]);

  return [settings, setSettings];
}

/** Turn the API's adhan times into [adhan, end] busy blocks using the settings. */
export function toBlocks(prayers, settings) {
  return PRAYERS.map((p) => [prayers[p], addMinutes(prayers[p], Math.max(blockLength(settings[p]), 1))]);
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function BlockSettings({ settings, onChange }) {
  const update = (prayer, field, value) => {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n)) return;
    onChange({ ...settings, [prayer]: { ...settings[prayer], [field]: Math.max(0, Math.round(n)) } });
  };

  return (
    <section className="card settings">
      <div className="toolbar">
        <div>
          <h2>Prayer blocks</h2>
          <p className="subtle">Each block runs from the adhan until the end of the salat and any time after it.</p>
        </div>
        <button type="button" className="ghost" onClick={() => onChange(DEFAULT_SETTINGS)}>
          Reset to defaults
        </button>
      </div>
      <div className="prayer-grid">
        {PRAYERS.map((p, i) => (
          <div key={p} className={`prayer-card p-${i}`}>
            <div className="prayer-card-head">
              <span className="prayer-ar" lang="ar">
                {NAMES[i]}
              </span>
            </div>
            {FIELDS.map((f) => (
              <label key={f.key} className="field">
                <span>{f.label}</span>
                <span className="field-input">
                  <input
                    type="number"
                    min={f.min}
                    max="240"
                    value={settings[p][f.key]}
                    onChange={(e) => update(p, f.key, e.target.value)}
                  />
                  <em>min</em>
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
