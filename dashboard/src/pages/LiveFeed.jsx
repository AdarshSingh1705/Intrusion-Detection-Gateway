import { useState, useEffect, useCallback } from 'react';
import { getEvents, getAlerts, acknowledgeAlert, blockIp } from '../api/client';

const VERDICT_STYLES = {
  block:     'bg-red-900 text-red-300',
  throttle:  'bg-yellow-900 text-yellow-300',
  challenge: 'bg-orange-900 text-orange-300',
  allow:     'bg-green-900 text-green-300',
};

const SEVERITY_STYLES = {
  high:   'text-red-400',
  medium: 'text-yellow-400',
  low:    'text-green-400',
};

function Badge({ value, styleMap }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styleMap[value] || 'bg-gray-700 text-gray-300'}`}>
      {value}
    </span>
  );
}

export default function LiveFeed() {
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [blockedIp, setBlockedIp] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [evts, alts] = await Promise.all([getEvents({ limit: 100 }), getAlerts(false)]);
      setEvents(evts);
      setAlerts(alts);
    } catch (err) {
      console.error('Fetch failed', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleAcknowledge(id) {
    await acknowledgeAlert(id);
    setAlerts((prev) => prev.filter((a) => a._id !== id));
  }

  async function handleBlockIp(ip) {
    await blockIp(ip);
    setBlockedIp(ip);
    setTimeout(() => setBlockedIp(''), 3000);
  }

  const filtered = filter
    ? events.filter((e) => e.verdict === filter)
    : events;

  return (
    <div className="space-y-6">
      {/* Unacknowledged alerts banner */}
      {alerts.length > 0 && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-4">
          <h2 className="text-red-400 font-semibold mb-3">🚨 Unacknowledged Alerts ({alerts.length})</h2>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a._id} className="flex items-center justify-between bg-red-900/40 px-3 py-2 rounded">
                <span className="text-sm text-red-200">
                  {a.eventId?.ruleTriggered || 'unknown'} — IP: {a.eventId?.ip || '?'} — {new Date(a.sentAt).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => handleAcknowledge(a._id)}
                  className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-white"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event table */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold text-gray-200">Live Event Feed</h2>
          <div className="flex gap-2">
            {['', 'block', 'throttle', 'challenge', 'allow'].map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`text-xs px-3 py-1 rounded ${filter === v ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {v || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm p-4">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm p-4">No events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <tr>
                  {['Time', 'IP', 'Method', 'Path', 'Verdict', 'Rule', 'Severity', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-300">{e.ip}</td>
                    <td className="px-4 py-2 text-gray-400">{e.method}</td>
                    <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{e.path}</td>
                    <td className="px-4 py-2">
                      <Badge value={e.verdict} styleMap={VERDICT_STYLES} />
                    </td>
                    <td className="px-4 py-2 text-gray-400">{e.ruleTriggered || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold ${SEVERITY_STYLES[e.severity]}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {e.verdict === 'allow' && (
                        <button
                          onClick={() => handleBlockIp(e.ip)}
                          className="text-xs bg-red-800 hover:bg-red-700 px-2 py-1 rounded text-white"
                        >
                          {blockedIp === e.ip ? 'Blocked ✓' : 'Block IP'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
