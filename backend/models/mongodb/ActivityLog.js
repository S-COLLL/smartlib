/**
 * ============================================================================
 * SMARTLIB — ActivityLog Model (MongoDB)
 * ============================================================================
 * Audit trail and security log tracking administrative and user actions across
 * the library management system.
 * Includes a TTL (Time-To-Live) index to automatically prune logs older than 365 days.
 * ============================================================================
 */

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: Number,
      required: [true, 'actorId referencing MySQL users.user_id is required'],
      index: true
    },
    actorName: {
      type: String,
      trim: true
    },
    actorRole: {
      type: String,
      trim: true
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      index: true,
      trim: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required (e.g. book, loan, member, reservation, fine)'],
      trim: true
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed
    },
    description: {
      type: String,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      trim: true
    },
    correlationId: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// TTL index: auto-delete records after 365 days (31536000 seconds)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

// Composite indexes for audit queries & admin dashboards
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
