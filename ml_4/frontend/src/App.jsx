import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_URL = `${import.meta.env.VITE_API_URL}/predict`;

const PLATFORMS = [
  'Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter',
  'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp', 'WeChat'
];

const STRESS_LEVELS = ['Low', 'Medium', 'High', 'Very High'];

// Maps the 0–10 score to a short, plain-language read. Purely descriptive —
// the model is the source of truth for the number itself.
function describeScore(score) {
  if (score <= 3) return { label: 'Running low', tone: 'Habits look settled this week.', good: true };
  if (score <= 5.5) return { label: 'Holding steady', tone: 'A fairly balanced rhythm overall.', good: false };
  if (score <= 7.5) return { label: 'A bit stretched', tone: 'A few habits are pulling in the wrong direction.', good: false };
  return { label: 'Signal is spiking', tone: 'Several inputs are running hot at once.', good: false };
}

// Turns the raw inputs into 1–3 concrete, ranked suggestions. Each rule is
// tied to an actual field the person entered, not generic advice.
function generateAdvice(formData) {
  const sleep = Number(formData.sleep_hours_per_night);
  const screen = Number(formData.avg_daily_usage_hours);
  const unlocks = Number(formData.daily_unlocks);
  const activity = Number(formData.physical_activity_hours);
  const stress = formData.stress_level;

  const candidates = [
    !Number.isNaN(sleep) && sleep < 6 &&
      'Sleep is under 6 hours — even 30–45 extra minutes tends to move this the most.',
    (stress === 'High' || stress === 'Very High') &&
      'Stress is marked high — that alone is likely the biggest factor in this reading.',
    !Number.isNaN(screen) && screen > 6 &&
      'Screen time is running high — trimming an hour off your top app would ease this.',
    !Number.isNaN(unlocks) && unlocks > 80 &&
      'Phone unlocks are frequent — batching checks instead of reflexive ones would help.',
    !Number.isNaN(activity) && activity < 0.5 &&
      'Barely any movement logged today — a short walk goes further than it seems.'
  ].filter(Boolean);

  return candidates.slice(0, 3);
}

// Animates a number from its previous value to a new one — used only for the
// score reveal, which is the one deliberate motion moment in this UI.
function useCountUp(target, durationMs = 900) {
  const [value, setValue] = useState(target ?? 0);
  const fromRef = useRef(value);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const from = fromRef.current;
    const start = performance.now();

    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

const APPLAUSE_DOTS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * 2 * Math.PI;
  const dist = 46 + (i % 2) * 16;
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist),
    delay: (i % 5) * 0.03
  };
});

// A one-shot burst, replayed by remounting with a fresh key whenever a new
// good score comes in — the single celebratory motion moment in this UI.
function Applause() {
  return (
    <div className="applause" aria-hidden="true">
      {APPLAUSE_DOTS.map((d, i) => (
        <span
          key={i}
          className="applause-dot"
          style={{ '--x': `${d.x}px`, '--y': `${d.y}px`, animationDelay: `${d.delay}s` }}
        />
      ))}
    </div>
  );
}

function SignalRing({ score, celebrate }) {
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(10, score)) / 10;
  const offset = circumference * (1 - pct);
  const animated = useCountUp(score);
  const ticks = Array.from({ length: 36 }, (_, i) => i);

  return (
    <div className="ring-wrap">
      {celebrate && <Applause key={score} />}
      <div className="ring-glow" style={{ opacity: score === null ? 0 : 0.25 + pct * 0.45 }} />
      <svg viewBox="0 0 220 220" className="ring-svg">
        <g className="ring-ticks">
          {ticks.map((i) => (
            <line
              key={i}
              x1="110" y1="8" x2="110" y2={i % 3 === 0 ? 18 : 14}
              className={i % 3 === 0 ? 'tick-major' : 'tick-minor'}
              transform={`rotate(${(i / ticks.length) * 360} 110 110)`}
            />
          ))}
        </g>
        <circle cx="110" cy="110" r={radius} className="ring-track" />
        <circle
          cx="110"
          cy="110"
          r={radius}
          className="ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={score === null ? circumference : offset}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-value">
          {score === null ? '—' : animated.toFixed(1)}
          <span>/10</span>
        </div>
      </div>
    </div>
  );
}

const STRESS_INDEX = { Low: 0, Medium: 1, High: 2, 'Very High': 3 };

function ratio(value, max) {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n / max));
}

// A live readout of the inputs feeding the score, so the right panel reflects
// what's been entered even before a reading comes back.
function LiveMeta({ formData }) {
  const rows = [
    {
      key: 'screen',
      label: 'Screen time',
      value: formData.avg_daily_usage_hours ? `${formData.avg_daily_usage_hours}h` : '—',
      pct: ratio(formData.avg_daily_usage_hours, 12),
      icon: <svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><line x1="10.5" y1="18.2" x2="13.5" y2="18.2" /></svg>
    },
    {
      key: 'sleep',
      label: 'Sleep',
      value: formData.sleep_hours_per_night ? `${formData.sleep_hours_per_night}h` : '—',
      pct: ratio(formData.sleep_hours_per_night, 10),
      icon: <svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" /></svg>
    },
    {
      key: 'stress',
      label: 'Stress',
      value: formData.stress_level || '—',
      pct: formData.stress_level ? (STRESS_INDEX[formData.stress_level] + 1) / 4 : 0,
      icon: <svg viewBox="0 0 24 24"><path d="M3 13h4l2-8 4 16 2-10 1.5 2H21" /></svg>
    }
  ];

  return (
    <div className="live-meta">
      {rows.map((row) => (
        <div className="meta-row" key={row.key}>
          <span className="meta-icon">{row.icon}</span>
          <div className="meta-body">
            <div className="meta-top">
              <span className="meta-label">{row.label}</span>
              <span className="meta-value">{row.value}</span>
            </div>
            <div className="meta-bar"><div className="meta-bar-fill" style={{ width: `${row.pct * 100}%` }} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PulseLoader() {
  return (
    <svg viewBox="0 0 200 40" className="pulse-loader" aria-hidden="true">
      <path d="M0 20 H60 L75 4 L92 36 L108 12 L120 28 L135 20 H200" />
    </svg>
  );
}

export default function App() {
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    country: '',
    academic_level: '',
    most_used_platform: '',
    purpose_of_use: '',
    avg_daily_usage_hours: '',
    daily_unlocks: '',
    study_hours: '',
    physical_activity_hours: '',
    sleep_hours_per_night: '',
    stress_level: ''
  });

  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRadioChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        age: parseInt(formData.age),
        gender: formData.gender,
        country: formData.country,
        academic_level: formData.academic_level,
        most_used_platform: formData.most_used_platform,
        purpose_of_use: formData.purpose_of_use,
        avg_daily_usage_hours: parseFloat(formData.avg_daily_usage_hours),
        daily_unlocks: parseInt(formData.daily_unlocks),
        study_hours: parseFloat(formData.study_hours),
        physical_activity_hours: parseFloat(formData.physical_activity_hours),
        sleep_hours_per_night: parseFloat(formData.sleep_hours_per_night),
        stress_level: formData.stress_level
      };

      const response = await axios.post(API_URL, payload);
      setScore(response.data.predicted_mental_health_score);
    } catch (err) {
      console.error(err);
      setError('Could not generate a reading. Check your inputs and that the API is running.');
    } finally {
      setLoading(false);
    }
  };

  const descriptor = score === null ? null : describeScore(score);
  const tips = score === null ? [] : generateAdvice(formData);

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <div className="layout">
        <div className="left-panel">
          <div className="page-header">
            <h1 className="page-title">How's your signal today?</h1>
            <p className="page-subtitle">
              A quick read on how screen time, sleep, and stress line up right now —
              modeled from your daily rhythm, not a diagnosis.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-section">
              <div className="section-head">
                <span className="section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" /></svg>
                </span>
                <h2>About you</h2>
              </div>
              <div className="form-grid three-cols">
                <div className="form-group">
                  <label htmlFor="age">Age</label>
                  <input id="age" type="number" name="age" placeholder="21" value={formData.age} onChange={handleInputChange} required min="10" max="100" />
                </div>
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <div className="select-wrap">
                    <select id="gender" name="gender" value={formData.gender} onChange={handleInputChange} required>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input id="country" type="text" name="country" placeholder="India" value={formData.country} onChange={handleInputChange} required />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="section-head">
                <span className="section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><line x1="10.5" y1="18.2" x2="13.5" y2="18.2" /></svg>
                </span>
                <h2>Your digital day</h2>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="academic_level">Academic level</label>
                  <div className="select-wrap">
                    <select id="academic_level" name="academic_level" value={formData.academic_level} onChange={handleInputChange} required>
                      <option value="">Select</option>
                      <option value="High School">High School</option>
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Graduate">Graduate</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="most_used_platform">Most-used platform</label>
                  <div className="select-wrap">
                    <select id="most_used_platform" name="most_used_platform" value={formData.most_used_platform} onChange={handleInputChange} required>
                      <option value="">Select</option>
                      {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="purpose_of_use">Primary purpose</label>
                  <div className="select-wrap">
                    <select id="purpose_of_use" name="purpose_of_use" value={formData.purpose_of_use} onChange={handleInputChange} required>
                      <option value="">Select</option>
                      <option value="Networking">Networking</option>
                      <option value="Education">Education</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="News">News</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="avg_daily_usage_hours">Avg. daily screen time (hrs)</label>
                  <input id="avg_daily_usage_hours" type="number" step="0.1" name="avg_daily_usage_hours" placeholder="0.0" value={formData.avg_daily_usage_hours} onChange={handleInputChange} required min="0" max="24" />
                </div>
                <div className="form-group">
                  <label htmlFor="daily_unlocks">Daily phone unlocks</label>
                  <input id="daily_unlocks" type="number" name="daily_unlocks" placeholder="60" value={formData.daily_unlocks} onChange={handleInputChange} required min="0" />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="section-head">
                <span className="section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" /></svg>
                </span>
                <h2>Rest &amp; recovery</h2>
              </div>
              <div className="form-grid three-cols">
                <div className="form-group">
                  <label htmlFor="study_hours">Study hours / day</label>
                  <input id="study_hours" type="number" step="0.1" name="study_hours" placeholder="0.0" value={formData.study_hours} onChange={handleInputChange} required min="0" max="24" />
                </div>
                <div className="form-group">
                  <label htmlFor="physical_activity_hours">Activity / day (hrs)</label>
                  <input id="physical_activity_hours" type="number" step="0.1" name="physical_activity_hours" placeholder="0.0" value={formData.physical_activity_hours} onChange={handleInputChange} required min="0" max="24" />
                </div>
                <div className="form-group">
                  <label htmlFor="sleep_hours_per_night">Sleep / night (hrs)</label>
                  <input id="sleep_hours_per_night" type="number" step="0.1" name="sleep_hours_per_night" placeholder="0.0" value={formData.sleep_hours_per_night} onChange={handleInputChange} required min="0" max="24" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.1rem' }}>
                <label>Perceived stress level</label>
                <div className="radio-group" role="radiogroup">
                  {STRESS_LEVELS.map((level) => (
                    <button
                      type="button"
                      key={level}
                      role="radio"
                      aria-checked={formData.stress_level === level}
                      className={`radio-btn ${formData.stress_level === level ? 'selected' : ''}`}
                      onClick={() => handleRadioChange('stress_level', level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Reading your signal…' : 'Read my signal'}
            </button>
          </form>
        </div>

        <div className="right-panel">
          <div className="score-card">
            {loading ? (
              <>
                <p className="score-eyebrow">Reading…</p>
                <PulseLoader />
                <p className="score-tone">Weighing today's inputs against the pattern.</p>
              </>
            ) : score === null ? (
              <>
                <SignalRing score={null} />
                <h2 className="score-title">Your score will land here</h2>
                <p className="score-tone">Fill in the form and submit for a 0–10 reading.</p>
              </>
            ) : (
              <>
                <SignalRing score={score} celebrate={descriptor.good} />
                <h2 className={`score-title ${descriptor.good ? 'is-good' : ''}`}>{descriptor.label}</h2>
                <p className="score-tone">{descriptor.tone}</p>
                <div className="advice">
                  <p className="advice-heading">{tips.length ? 'Where to focus' : 'Reading the pattern'}</p>
                  {tips.length ? (
                    <ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  ) : (
                    <p className="advice-empty">No single habit stands out — the pattern looks fairly even.</p>
                  )}
                </div>
              </>
            )}
            <LiveMeta formData={formData} />
          </div>
        </div>
      </div>
    </div>
  );
}