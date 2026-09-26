const mongoose = require('mongoose');

// Atomic sequence counters used to generate human-readable IDs (BK0001, TXN00001, ...)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
