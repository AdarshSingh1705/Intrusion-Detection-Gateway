const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

function makeResponse() {
  return {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function makeReq(role, tenantId, params = {}) {
  return {
    headers: {
      authorization: `Bearer ${jwt.sign({ sub: 'u1', tenantId, role }, process.env.JWT_SECRET)}`,
    },
    params,
    query: {},
    body: {},
    user: null,
  };
}

test('rejects cross-tenant admin access', () => {
  const req = makeReq('admin', 'tenant-a', { tenantId: 'tenant-b' });
  const res = makeResponse();
  let nextCalled = false;

  requireTenantAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.code, 403);
  assert.deepEqual(res.payload, { error: 'cross-tenant access rejected' });
  assert.equal(nextCalled, false);
});

test('allows same-tenant admin access', () => {
  const req = makeReq('admin', 'tenant-a', { tenantId: 'tenant-a' });
  const res = makeResponse();
  let nextCalled = false;

  requireTenantAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.code, undefined);
  assert.equal(nextCalled, true);
});

test('allows superadmin across tenant-bound routes', () => {
  const req = makeReq('superadmin', 'default', { tenantId: 'tenant-a' });
  const res = makeResponse();
  let nextCalled = false;

  requireTenantAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.code, undefined);
  assert.equal(nextCalled, true);
});
