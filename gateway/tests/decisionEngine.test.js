const test = require('node:test');
const assert = require('node:assert/strict');
const evaluateDecisionEngine = require('../core/decisionEngine');

test('Decision Engine - priority order: injection > auth > rate > allow', () => {
  const guardResults = [
    { verdict: 'suspicious', reason: 'rate_abuse', action: 'throttle' },
    { verdict: 'malicious', reason: 'sqli_union_select', action: 'block' },
    { verdict: 'malicious', reason: 'brute_force', action: 'block_ip' },
  ];

  const result = evaluateDecisionEngine(guardResults);
  // Payload injection should take priority over rate abuse and auth
  assert.equal(result.finalVerdict, 'block');
  assert.equal(result.triggeredBy, 'sqli_union_select');
});

test('Decision Engine - returns allow when all guards are clean', () => {
  const guardResults = [
    { verdict: 'clean' },
    { verdict: 'clean' },
    { verdict: 'clean' },
  ];

  const result = evaluateDecisionEngine(guardResults);
  assert.equal(result.finalVerdict, 'allow');
});
