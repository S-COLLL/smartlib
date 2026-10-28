/**
 * ============================================================================
 * SMARTLIB — Notification Model (MongoDB)
 * ============================================================================
 * Stores member and staff notifications for due dates, overdue notices,
 * hold availabilities, fines, payments, and system alerts.
 * ============================================================================
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: Number,
      required: [true, 'recipientId referencing MySQL users.user_id is required'],
      index: true
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: [
        'loan_due',
        'loan_overdue',
        'reservation_ready',
        'reservation_expired',
        'fine_assessed',
        'fine_paid',
        'system',
        'welcome'
      ]
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    relatedEntity: {
      type: {
        type: String,
        enum: ['book', 'loan', 'reservation', 'fine']
      },
      id: {
        type: mongoose.Schema.Types.Mixed
      }
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'delivered'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// High performance compound index for member inbox feeds
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = Notification;
