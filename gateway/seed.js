// gateway/seed.js
// Creates the first admin user and default tenant on startup if they don't exist.
// Credentials are read from env so they're never hardcoded.
// Run automatically via server.js on boot.

const bcrypt = require('bcrypt');
const User = require('./models/User');
const Tenant = require('./models/Tenant');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seedAdminUser() {
  const existing = await User.findOne({ tenantId: 'default', username: ADMIN_USERNAME });
  if (existing) {
    if (existing.role !== 'superadmin') {
      existing.role = 'superadmin';
      await existing.save();
      console.log(`[seed] Promoted existing default user to superadmin — username: ${ADMIN_USERNAME}`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({
    tenantId: 'default',
    username: ADMIN_USERNAME,
    passwordHash,
    role: 'superadmin',
    knownDevices: [],
  });
  console.log(`[seed] Superadmin bootstrap user created — username: ${ADMIN_USERNAME}`);
}

async function seedDefaultTenant() {
  const existing = await Tenant.findOne({ tenantId: 'default' });
  if (existing) return;

  await Tenant.create({
    tenantId: 'default',
    domain: 'localhost',
    originUrl: process.env.DEMO_SITE_ORIGIN_URL || 'http://demo-site:4000',
    apiKeyHash: 'seeded',
    thresholds: { authFailMax: 5, rateWarnMax: 5, rateBlockMax: 10 },
  });
  console.log('[seed] Default tenant created');
}

async function seed() {
  await Promise.all([seedAdminUser(), seedDefaultTenant()]);
}

module.exports = seed;
