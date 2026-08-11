const { validateEnvironment, getHealthSnapshot } = require('./config/startup');
validateEnvironment();

const mongoose = require('./config/db');
require('./config/redis');
require('./services/healthMonitor');

const express = require('express');
const app = express();

app.set('trust proxy', true);
app.use(express.json());
app.use(require('./middleware/tenantScope'));

app.get('/health', async (req, res) => {
  const health = await getHealthSnapshot();

  const statusCode = health.status === 'ok' ? 200 : 503;

  res.status(statusCode).json(health);
});

// Dashboard-facing routes (do NOT go through the proxy/guards pipeline)
app.use('/auth', require('./middleware/guardCheck'), require('./routes/auth'));
app.use('/api/tenants', require('./middleware/requireAuth'), require('./routes/tenants'));
app.use('/api', require('./middleware/requireAuth'), require('./routes/api'));

// Circuit breaker runs before the proxy — serves holding page if origin is down
app.use(require('./middleware/circuitBreaker'));
app.use(require('./proxy'));

const PORT = process.env.PORT || 8080;

// Wait for MongoDB to be ready before seeding
mongoose.connection.once('open', async () => {
  const seedAdminUser = require('./seed');
  await seedAdminUser();
});

const server = app.listen(PORT, () => {
  console.log(`Gateway listening on ${PORT}`);
});

async function gracefulShutdown(signal) {
  console.log(`[shutdown] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('[shutdown] MongoDB connection closed');

      const redis = require('./config/redis');
      await redis.quit();
      console.log('[shutdown] Redis connection closed');

      process.exit(0);
    } catch (err) {
      console.error('[shutdown] Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Don't wait forever if a connection refuses to close.
  setTimeout(() => {
    console.error('[shutdown] Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
