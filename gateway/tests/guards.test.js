const test = require('node:test');
const assert = require('node:assert/strict');
const evaluatePayloadGuard = require('../guards/payloadGuard');

test('Payload Guard - detects SQL Injection union select', () => {
  const req = {
    query: { id: "1' UNION SELECT * FROM users--" },
    body: {},
    headers: {},
  };
  const result = evaluatePayloadGuard(req);
  assert.equal(result.verdict, 'malicious');
  assert.equal(result.action, 'block');
  assert.equal(result.reason, 'sqli_union_select');
});

test('Payload Guard - detects XSS script tags', () => {
  const req = {
    query: {},
    body: { comment: "<script>alert('xss')</script>" },
    headers: {},
  };
  const result = evaluatePayloadGuard(req);
  assert.equal(result.verdict, 'malicious');
  assert.equal(result.action, 'block');
  assert.equal(result.reason, 'xss_script_tag');
});

test('Payload Guard - allows benign requests with hex colors or hash anchors', () => {
  const req = {
    query: { section: 'header#overview' },
    body: { color: '#ffffff' },
    headers: { cookie: 'theme=dark; color=#123456' },
  };
  const result = evaluatePayloadGuard(req);
  assert.equal(result.verdict, 'clean');
});

test('Payload Guard - detects inline SQL comments with queries', () => {
  const req = {
    query: { id: "1; # SELECT * FROM users" },
    body: {},
    headers: {},
  };
  const result = evaluatePayloadGuard(req);
  assert.equal(result.verdict, 'malicious');
  assert.equal(result.reason, 'sqli_comment');
});
