const { getCircuitState, setCircuitState, recordResult } = require('../services/healthMonitor');

module.exports = async function circuitBreaker(req, res, next) {
  const tenantId = req.tenantId || 'default';
  const state = await getCircuitState(tenantId);

  if (state === 'open') {
    return res.status(503).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h1>Service Temporarily Unavailable</h1>
        <p>We are experiencing issues. Please try again shortly.</p>
      </body></html>
    `);
  }

  if (state === 'half-open') {
    // Let the request through as a test probe
    res.on('finish', async () => {
      const failed = res.statusCode >= 500;
      await recordResult(tenantId, failed);
      if (!failed) await setCircuitState(tenantId, 'closed');
      else await setCircuitState(tenantId, 'open');
    });
  }

  next();
};
