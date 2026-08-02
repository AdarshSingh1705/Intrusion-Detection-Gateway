// gateway/config/db.js
// MongoDB connection setup. Reference: LLD S4 (Database Schema)
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection failed', err));
module.exports = mongoose;
