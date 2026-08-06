const evaluateAuthGuard = require('../guards/authGuard');
const evaluateRateGuard = require('../guards/rateGuard');
const evaluatePayloadGuard = require('../guards/payloadGuard');
const decide = require('./decisionEngine');
const logEvent = require('../middleware/logger');
const { sendAlert } = require('../services/alerting');

async function runGuards(req, tenantConfig) {
  const [authResult, rateResult, payloadResult] = await Promise.all([
    evaluateAuthGuard(req, tenantConfig),
    evaluateRateGuard(req, tenantConfig),
    evaluatePayloadGuard(req),
  ]);

  const degraded = authResult.degraded || rateResult.degraded;
  const verdict = decide([authResult, rateResult, payloadResult]);
  if (degraded) verdict.degraded = true;

  logEvent(req, verdict).then((event) => {
    if (event && (verdict.finalVerdict === 'block' || verdict.finalVerdict === 'challenge')) {
      sendAlert(tenantConfig.tenantId, event);
    }
  });

  return verdict;
}

module.exports = runGuards;
