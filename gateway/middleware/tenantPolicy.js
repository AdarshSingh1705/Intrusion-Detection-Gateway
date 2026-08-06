function resolveTenantAuthority(req) {
  return req.user?.tenantId || req.tenant?.tenantId || req.tenantId || null;
}

function getRequestedTenantId(req) {
  return req.params?.tenantId || req.query?.tenantId || req.body?.tenantId || null;
}

function resolveEffectiveTenantId(req) {
  const requested = getRequestedTenantId(req);
  if (req.user?.role === 'superadmin' && requested) {
    return requested;
  }
  return resolveTenantAuthority(req);
}

function enforceTenantOwnership(req, res, next) {
  const authTenantId = resolveTenantAuthority(req);
  const requestedTenantId = getRequestedTenantId(req);

  if (!authTenantId) {
    return res.status(401).json({ error: 'tenant context missing' });
  }

  if (requestedTenantId && req.user?.role !== 'superadmin' && authTenantId !== requestedTenantId) {
    return res.status(403).json({ error: 'cross-tenant access rejected' });
  }

  req.tenantId = authTenantId;
  req.effectiveTenantId = resolveEffectiveTenantId(req);
  return next();
}

module.exports = {
  resolveTenantAuthority,
  getRequestedTenantId,
  resolveEffectiveTenantId,
  enforceTenantOwnership,
};
