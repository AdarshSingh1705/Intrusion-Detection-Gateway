import { useState } from 'react';
import { getEventsByIp, blockIp, unblockIp, checkIpBlocked } from '../api/client';

const VERDICT_STYLES = {
  block:     'bg-red-900 text-red-300',
  throttle:  'bg-yellow-900 text-yellow-300',
  challenge: 'bg-orange-900 text-orange-300',
  allow:     'bg-green-900 text-green-300',
};

export default function Investigate() {
  const [ip, setIp] = useState('');
  const [events, setEvents] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isCurrentlyBlocked, setIsCurrentlyBlocked] = useState(false);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    const searchIp = ip.trim();
    if (!searchIp) return;
    setLoading(true);
    setSearched(false);
    setStatus('');
    try {
      const [data, blockState] = await Promise.all([
        getEventsByIp(searchIp),
        checkIpBlocked(searchIp).catch(() => ({ blocked: false })),
      ]);
      setEvents(data);
      setIsCurrentlyBlocked(Boolean(blockState?.blocked));
      setSearched(true);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleBlock() {
    const targetIp = ip.trim();
    if (!targetIp) return;
    try {
      await blockIp(targetIp);
      setStatus(`✓ ${targetIp} blocked for 15 minutes in Redis`);
      setIsCurrentlyBlocked(true);
      handleSearch();
    } catch (err) {
      setStatus(`Error blocking IP: ${err.message}`);
    }
  }

  async function handleUnblock() {
    const targetIp = ip.trim();
    if (!targetIp) return;
    try {
      await unblockIp(targetIp);
      setStatus(`✓ ${targetIp} unblocked from Redis`);
      setIsCurrentlyBlocked(false);
      handleSearch();
    } catch (err) {
      setStatus(`Error unblocking IP: ${err.message}`);
    }
  }

  const blockCount = events.filter((e) => e.verdict === 'block').length;
  const throttleCount = events.filter((e) => e.verdict === 'throttle').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-gray-900 rounded-lg p-4">
        <h2 className="font-semibold text-gray-200 mb-4">Investigate IP</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono"
            placeholder="Enter IP address e.g. 127.0.0.1 or 172.18.0.1"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-semibold"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {status && <p className="mt-2 text-sm text-green-400 font-mono">{status}</p>}
      </div>

      {searched && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-200">{events.length}</p>
              <p className="text-gray-500 text-sm">Total Events</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{blockCount}</p>
              <p className="text-gray-500 text-sm">Blocks</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{throttleCount}</p>
              <p className="text-gray-500 text-sm">Throttles</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center flex flex-col items-center justify-center">
              <span className={`px-3 py-1 rounded text-xs font-bold ${isCurrentlyBlocked ? 'bg-red-900 text-red-300 border border-red-500' : 'bg-green-900 text-green-300'}`}>
                {isCurrentlyBlocked ? 'BLOCKED IN REDIS' : 'NOT BLOCKED'}
              </span>
              <p className="text-gray-500 text-xs mt-1">Current State</p>
            </div>
          </div>

          {/* Manual controls */}
          <div className="flex gap-3 items-center">
            <button
              onClick={handleBlock}
              className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold"
            >
              Block {ip}
            </button>
            <button
              onClick={handleUnblock}
              className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold"
            >
              Unblock {ip}
            </button>
          </div>

          {/* Event history */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-gray-200">Event History for {ip}</h3>
            </div>
            {events.length === 0 ? (
              <p className="text-gray-500 text-sm p-4">No events found for this IP.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs uppercase border-b border-gray-800">
                    <tr>
                      {['Time', 'Method', 'Path', 'Verdict', 'Rule', 'Severity'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-gray-400">{e.method}</td>
                        <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{e.path}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${VERDICT_STYLES[e.verdict] || 'bg-gray-700 text-gray-300'}`}>
                            {e.verdict}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-400">{e.ruleTriggered || '—'}</td>
                        <td className="px-4 py-2 text-gray-400">{e.severity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
