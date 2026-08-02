import { useState, useEffect } from 'react';
import { getTenant, updateThresholds } from '../api/client';

const TENANT_ID = 'default';

const FIELDS = [
  {
    key: 'authFailMax',
    label: 'Auth Fail Max',
    description: 'Failed login attempts before account is locked',
    min: 1,
    max: 20,
  },
  {
    key: 'rateWarnMax',
    label: 'Rate Warn Max',
    description: 'Requests per minute before throttling starts',
    min: 1,
    max: 1000,
  },
  {
    key: 'rateBlockMax',
    label: 'Rate Block Max',
    description: 'Requests per minute before IP is blocked',
    min: 1,
    max: 2000,
  },
];

export default function Settings() {
  const [values, setValues] = useState({ authFailMax: 5, rateWarnMax: 5, rateBlockMax: 10 });
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTenant(TENANT_ID)
      .then((tenant) => {
        if (tenant?.thresholds) setValues(tenant.thresholds);
      })
      .catch(() => {
        // tenant not found in DB yet (first run) — keep defaults
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key, val) {
    setValues((prev) => ({ ...prev, [key]: Number(val) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (values.rateWarnMax >= values.rateBlockMax) {
      setStatus('Error: Rate Warn Max must be less than Rate Block Max');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      await updateThresholds(TENANT_ID, values);
      setStatus('✓ Thresholds saved successfully');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading current thresholds...</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="font-semibold text-gray-200 mb-1">Detection Thresholds</h2>
        <p className="text-gray-500 text-sm mb-6">
          Changes apply to the default tenant. Lower values = stricter detection.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {FIELDS.map(({ key, label, description, min, max }) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-300">{label}</label>
                <span className="text-indigo-400 font-mono font-bold">{values[key]}</span>
              </div>
              <p className="text-gray-500 text-xs mb-2">{description}</p>
              <input
                type="range"
                min={min}
                max={max}
                value={values[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{min}</span>
                <span>{max}</span>
              </div>
            </div>
          ))}

          {status && (
            <p className={`text-sm ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {status}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Thresholds'}
          </button>
        </form>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-500 space-y-1">
        <p>⚠️ <strong className="text-gray-400">Rate Block Max</strong> must always be greater than Rate Warn Max.</p>
        <p>⚠️ Changes here update MongoDB but do not reset active Redis counters.</p>
        <p>⚠️ To reset counters, use the Investigate page to manually unblock an IP.</p>
      </div>
    </div>
  );
}
