// gateway/core/decisionEngine.js
// Merges the three guards' verdicts using a fixed priority order.
// Reference: LLD S2 (Decision Engine - Merge Logic)
//
// Priority: sqli/xss malicious > auth malicious > rate malicious >
//           any suspicious > allow

function decide(guardResults) {
  // Priority 1: injection attacks (sqli/xss) — highest, no exceptions
  const injection = guardResults.find(
    (r) => r.verdict === 'malicious' && (r.reason.startsWith('sqli_') || r.reason.startsWith('xss_'))
  );
  if (injection) {
    return { finalVerdict: 'block', triggeredBy: injection.reason, severity: 'high' };
  }

  // Priority 2 & 3: any other malicious (brute_force, credential_stuffing, rate_flood)
  const malicious = guardResults.find((r) => r.verdict === 'malicious');
  if (malicious) {
    return { finalVerdict: 'block', triggeredBy: malicious.reason, severity: 'high' };
  }

  // Priority 4: suspicious
  const suspicious = guardResults.find((r) => r.verdict === 'suspicious');
  if (suspicious) {
    return {
      finalVerdict: suspicious.action === 'challenge' ? 'challenge' : 'throttle',
      triggeredBy: suspicious.reason,
      severity: 'medium',
    };
  }

  return { finalVerdict: 'allow', triggeredBy: null, severity: 'low' };
}

module.exports = decide;
