const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../frontend/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `cover-${uniqueSuffix}${ext}`);
  },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type: Only JPEG, PNG, WEBP, and GIF images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * POST / - Upload book cover image (admin/librarian)
 * Accepts form-data with field name 'coverImage', 'image', or 'file'
 */
router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'librarian'),
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      const file = req.files && req.files.length > 0 ? req.files[0] : req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No image file uploaded. Please provide a file under coverImage, image, or file field.',
        });
      }

      const fileUrl = `/uploads/${file.filename}`;

      ActivityLog.create({
        action: 'COVER_UPLOADED',
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          url: fileUrl,
        },
        targetType: 'Image',
        ipAddress: req.ip || '',
      }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: 'Book cover image uploaded successfully',
        data: {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          url: fileUrl,
        },
        url: fileUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
