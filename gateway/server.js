const mongoose = require('./config/db');
require('./config/redis');
require('./services/healthMonitor');

const express = require('express');
const app = express();
app.use(express.json());
app.use(require('./middleware/tenantScope'));

// Dashboard-facing routes (do NOT go through the proxy/guards pipeline)
app.use('/auth', require('./middleware/guardCheck'), require('./routes/auth'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api', require('./middleware/adminAuth'), require('./routes/api'));

// Circuit breaker runs before the proxy — serves holding page if origin is down
app.use(require('./middleware/circuitBreaker'));
app.use(require('./proxy'));

const PORT = process.env.PORT || 8080;

// Wait for MongoDB to be ready before seeding
mongoose.connection.once('open', async () => {
  const seedAdminUser = require('./seed');
  await seedAdminUser();
});

app.listen(PORT, () => console.log(`Gateway listening on ${PORT}`));
