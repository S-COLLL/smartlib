/**
 * SMARTLIB - Formatting Utilities Module
 * Dates, times, currency, badges, book covers, avatars, ratings, and shelf hierarchical locations.
 */

(function () {
  'use strict';

  const format = {
    /**
     * Format date string to 'Oct 18, 2024'
     */
    date(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    },

    /**
     * Format date and time string to 'Oct 18, 2024, 02:30 PM'
     */
    dateTime(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    },

    /**
     * Format relative time string e.g. '2 hours ago', 'in 3 days'
     */
    relativeTime(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);

      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffSecs = Math.round(diffMs / 1000);
      const isPast = diffSecs < 0;
      const absSecs = Math.abs(diffSecs);

      if (absSecs < 45) return 'just now';

      const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 }
      ];

      for (const interval of intervals) {
        const count = Math.floor(absSecs / interval.seconds);
        if (count >= 1) {
          const plural = count === 1 ? '' : 's';
          return isPast ? `${count} ${interval.label}${plural} ago` : `in ${count} ${interval.label}${plural}`;
        }
      }

      return 'just now';
    },

    /**
     * Format currency amount (defaults to Rs. 100.00)
     */
    currency(amount) {
      const num = Number(amount) || 0;
      return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    /**
     * Format numeric value with thousands separator
     */
    number(num) {
      if (num === null || num === undefined) return '0';
      return Number(num).toLocaleString();
    },

    /**
     * Truncate text with ellipsis
     */
    truncate(str, maxLen = 60) {
      if (!str) return '';
      const text = String(str);
      if (text.length <= maxLen) return text;
      return text.substring(0, maxLen).trim() + '...';
    },

    /**
     * Hierarchy string for shelf location
     * accepts object: { floor, section, rack, shelf } or { floor_number, section_name, rack_number, shelf_number }
     */
    shelfLocation(shelf) {
      if (!shelf) return 'Unassigned';
      if (typeof shelf === 'string') return shelf;

      const floor = shelf.floor_number ?? shelf.floor ?? '';
      const section = shelf.section_name ?? shelf.section ?? '';
      const rack = shelf.rack_number ?? shelf.rack ?? '';
      const shelfNum = shelf.shelf_number ?? shelf.shelf ?? '';

      const parts = [];
      if (floor) parts.push(`Floor ${floor}`);
      if (section) parts.push(`Section ${section}`);
      if (rack) parts.push(`Rack ${rack}`);
      if (shelfNum) parts.push(`Shelf ${shelfNum}`);

      return parts.length ? parts.join(' > ') : 'Unassigned';
    },

    /**
     * Status badge HTML element
     */
    statusBadge(status) {
      if (!status) return `<span class="badge badge-secondary">Unknown</span>`;
      const s = String(status).toUpperCase();

      switch (s) {
        case 'AVAILABLE':
        case 'ACTIVE':
        case 'PAID':
        case 'RETURNED':
        case 'COMPLETED':
          return `<span class="badge badge-available"><span class="badge-dot"></span>${s}</span>`;
        case 'ISSUED':
        case 'BORROWED':
        case 'UNPAID':
        case 'LOST':
          return `<span class="badge badge-issued"><span class="badge-dot"></span>${s}</span>`;
        case 'OVERDUE':
        case 'DAMAGED':
          return `<span class="badge badge-overdue"><span class="badge-dot"></span>${s}</span>`;
        case 'RESERVED':
        case 'PENDING':
          return `<span class="badge badge-reserved"><span class="badge-dot"></span>${s}</span>`;
        default:
          return `<span class="badge badge-secondary">${s}</span>`;
      }
    },

    /**
     * Availability stock badge HTML
     */
    availabilityBadge(available, total) {
      const avail = Number(available) || 0;
      const tot = Number(total) || 0;

      if (avail > 0) {
        return `<span class="badge badge-available"><span class="badge-dot"></span>${avail} / ${tot} Available</span>`;
      }
      return `<span class="badge badge-issued"><span class="badge-dot"></span>Out of Stock</span>`;
    },

    /**
     * Generate 5-star rating HTML
     */
    starRating(rating = 0, interactive = false, onChange = null) {
      const score = Math.round(Number(rating) * 2) / 2; // round to nearest half
      const interactiveClass = interactive ? ' interactive' : '';
      let starsHtml = `<div class="star-rating${interactiveClass}" data-rating="${score}">`;

      for (let i = 1; i <= 5; i++) {
        const isFilled = i <= score;
        starsHtml += `
          <span class="star${isFilled ? ' filled' : ''}" data-value="${i}" role="button" aria-label="${i} stars">
            &#9733;
          </span>
        `;
      }

      starsHtml += `<span class="star-rating-score">${Number(rating).toFixed(1)}</span></div>`;
      return starsHtml;
    },

    /**
     * Safe user initials generator
     */
    initials(name = '') {
      if (!name) return 'U';
      const parts = String(name).trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    },

    /**
     * Avatar HTML with image and initials fallback
     */
    avatar(name = '', image = null, size = '') {
      const sizeClass = size ? ` avatar-${size}` : '';
      const letters = this.initials(name);

      if (image) {
        return `
          <div class="avatar${sizeClass}">
            <img src="${image}" alt="${name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />
            <span style="display:none;">${letters}</span>
          </div>
        `;
      }

      return `<div class="avatar${sizeClass}"><span>${letters}</span></div>`;
    },

    /**
     * Book cover image with styled SVG book fallback
     */
    bookCover(coverImage, title = 'Book Cover') {
      if (coverImage) {
        return `<img src="${coverImage}" alt="${title}" class="book-cover-img" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'280\\' viewBox=\\'0 0 200 280\\'><rect width=\\'200\\' height=\\'280\\' fill=\\'%236D28D9\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23ffffff\\' font-size=\\'16\\' font-family=\\'sans-serif\\'>No Cover</text></svg>';" />`;
      }

      return `
        <div class="book-cover-img flex-center" style="background: linear-gradient(135deg, #6D28D9 0%, #21113D 100%); color: #ffffff; text-align: center; padding: var(--space-4);">
          <div class="flex-col flex-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 2v20"/></svg>
            <span class="text-xs font-semibold" style="margin-top: 8px; max-width: 90%; overflow: hidden; text-overflow: ellipsis;">${this.truncate(title, 30)}</span>
          </div>
        </div>
      `;
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.format = format;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = format;
  }
})();
