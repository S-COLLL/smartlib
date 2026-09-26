const mongoose = require('mongoose');

const shelfSchema = new mongoose.Schema(
  {
    shelfId: { type: String, unique: true, index: true }, // e.g. SH-A
    code: { type: String, required: [true, 'Shelf code is required'], uppercase: true, trim: true, unique: true }, // e.g. A
    name: { type: String, trim: true }, // e.g. Shelf A
    floor: { type: Number, required: [true, 'Floor is required'], min: 0, max: 20 },
    section: { type: String, required: [true, 'Section is required'], trim: true },
    racks: { type: Number, default: 4, min: 1, max: 50 },
    rowsPerRack: { type: Number, default: 4, min: 1, max: 26 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    capacity: { type: Number, required: [true, 'Capacity is required'], min: 1 },
    occupied: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Active', 'Maintenance', 'Closed'], default: 'Active' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

shelfSchema.virtual('availableSpace').get(function availableSpace() {
  return Math.max(0, this.capacity - this.occupied);
});
shelfSchema.virtual('occupancyPercent').get(function occupancyPercent() {
  return this.capacity ? Math.min(100, Math.round((this.occupied / this.capacity) * 100)) : 0;
});

shelfSchema.pre('validate', function setDefaults(next) {
  if (this.code) {
    if (!this.shelfId) this.shelfId = `SH-${this.code}`;
    if (!this.name) this.name = `Shelf ${this.code}`;
  }
  next();
});

shelfSchema.index({ floor: 1, section: 1 });

module.exports = mongoose.model('Shelf', shelfSchema);
