/**
 * SMARTLIB - Reusable Component HTML Templates & Builders
 * Generates semantic, accessible, 3D-styled UI components as HTML strings.
 */

(function () {
  'use strict';

  const components = {
    /**
     * 3D Book Card Component
     * @param {object} book 
     * @returns {string} HTML string
     */
    bookCard(book = {}) {
      const id = book.book_id || book.id || book._id || '';
      const title = book.title || 'Untitled Book';
      const author = book.author || book.authors || 'Unknown Author';
      const cover = book.cover_image || book.coverImage || null;
      const category = book.category_name || book.category || book.genre || 'General';
      const available = book.available_copies ?? book.availableCopies ?? 0;
      const total = book.total_copies ?? book.totalCopies ?? 1;
      const shelf = book.shelf_location || book.shelf || (book.floor ? { floor: book.floor, section: book.section_name || book.section, rack: book.rack_number, shelf: book.shelf_number } : null);
      const rating = book.avgRating ?? book.rating ?? book.average_rating ?? 0;

      const coverHtml = window.format ? window.format.bookCover(cover, title) : `<img src="${cover || ''}" alt="${title}" class="book-cover-img" />`;
      const availBadge = window.format ? window.format.availabilityBadge(available, total) : `<span class="badge badge-primary">${available} Left</span>`;
      const shelfText = window.format ? window.format.shelfLocation(shelf) : 'Floor 1';
      const starRatingHtml = window.format && rating ? window.format.starRating(rating) : '';

      return `
        <div class="book-card-3d card-enter" data-book-id="${id}">
          <div class="book-cover-container">
            ${coverHtml}
            <div class="book-cover-shine"></div>
            <div class="book-status-pill">${availBadge}</div>
          </div>
          <div class="book-card-details">
            <span class="badge badge-secondary" style="width: fit-content; margin-bottom: 6px; font-size: 0.65rem;">${category}</span>
            <h4 class="book-card-title" title="${title}">${title}</h4>
            <p class="book-card-author">by ${author}</p>
            ${starRatingHtml ? `<div style="margin-bottom: 8px;">${starRatingHtml}</div>` : ''}
            <div class="book-card-shelf">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16M6 4v16M18 4v16"/></svg>
              <span>${shelfText}</span>
            </div>
            <div class="book-card-footer">
              <a href="/pages/book-details.html?id=${id}" class="btn btn-secondary btn-sm" style="flex: 1;">Details</a>
              ${available > 0 ? `
                <button class="btn btn-primary btn-sm reserve-book-btn" data-id="${id}" title="Borrow or Reserve">
                  <span>Borrow</span>
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm reserve-book-btn" data-id="${id}" title="Place a Reservation">
                  <span>Reserve</span>
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    },

    /**
     * Stat / Metric 3D Card
     * @param {string} icon - SVG string or icon name
     * @param {string|number} value 
     * @param {string} label 
     * @param {string} color - primary, success, warning, danger, info
     * @param {object} trend - { value: '+12%', isPositive: true }
     * @returns {string} HTML string
     */
    statCard(icon, value, label, color = 'primary', trend = null) {
      const iconSvg = (typeof icon === 'string' && icon.startsWith('<svg')) ? icon : 
        ((window.navigation && window.navigation.icons[icon]) ? window.navigation.icons[icon] : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`);

      let trendHtml = '';
      if (trend) {
        const trendClass = trend.isPositive ? 'positive' : 'negative';
        const trendArrow = trend.isPositive ? '↑' : '↓';
        trendHtml = `
          <div class="stat-trend ${trendClass}">
            <span>${trendArrow} ${trend.value}</span>
            <span style="color: var(--text-muted); font-weight: normal;">vs last month</span>
          </div>
        `;
      }

      return `
        <div class="stat-card card-enter">
          <div class="stat-icon ${color}">
            ${iconSvg}
          </div>
          <div class="stat-info">
            <span class="stat-value">${value}</span>
            <span class="stat-label">${label}</span>
            ${trendHtml}
          </div>
        </div>
      `;
    },

    /**
     * Member Table Row
     * @param {object} member 
     * @returns {string} HTML string
     */
    memberRow(member = {}) {
      const id = member.id || member._id || '';
      const name = member.name || 'Unnamed Member';
      const email = member.email || '—';
      const phone = member.phone || '—';
      const role = member.role || 'MEMBER';
      const status = member.status || 'ACTIVE';
      const joined = window.format ? window.format.date(member.created_at || member.createdAt) : '—';
      const statusBadge = window.format ? window.format.statusBadge(status) : `<span class="badge">${status}</span>`;
      const avatarHtml = window.format ? window.format.avatar(name, member.avatar, 'sm') : '';

      return `
        <tr data-member-id="${id}">
          <td>
            <div class="flex-align-center gap-3">
              ${avatarHtml}
              <div class="flex-col">
                <span class="font-semibold text-sm" style="color: var(--text);">${name}</span>
                <span class="text-xs" style="color: var(--text-secondary);">${email}</span>
              </div>
            </div>
          </td>
          <td>${phone}</td>
          <td><span class="badge badge-secondary">${role}</span></td>
          <td>${statusBadge}</td>
          <td>${joined}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-icon btn-ghost btn-sm edit-member-btn" data-id="${id}" title="Edit Member">
                ${window.navigation ? window.navigation.icons.edit : '✎'}
              </button>
              <button class="btn btn-icon btn-ghost btn-sm delete-member-btn" data-id="${id}" title="Delete Member" style="color: var(--danger);">
                ${window.navigation ? window.navigation.icons.trash : '🗑'}
              </button>
            </div>
          </td>
        </tr>
      `;
    },

    /**
     * Circulation Loan Table Row
     * @param {object} loan 
     * @returns {string} HTML string
     */
    loanRow(loan = {}) {
      const id = loan.id || loan._id || '';
      const bookTitle = (loan.book && loan.book.title) || loan.book_title || 'Unknown Book';
      const memberName = (loan.user && loan.user.name) || loan.user_name || 'Member';
      const issueDate = window.format ? window.format.date(loan.issued_at || loan.issue_date) : '—';
      const dueDate = window.format ? window.format.date(loan.due_date) : '—';
      const returnDate = loan.returned_at ? (window.format ? window.format.date(loan.returned_at) : loan.returned_at) : null;
      const status = loan.status || (returnDate ? 'RETURNED' : 'ISSUED');
      const statusBadge = window.format ? window.format.statusBadge(status) : `<span class="badge">${status}</span>`;

      return `
        <tr data-loan-id="${id}">
          <td class="font-semibold">${bookTitle}</td>
          <td>${memberName}</td>
          <td>${issueDate}</td>
          <td class="font-mono text-xs">${dueDate}</td>
          <td>${returnDate || '<span class="text-muted">Not returned</span>'}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              ${status === 'ISSUED' || status === 'OVERDUE' ? `
                <button class="btn btn-primary btn-sm return-book-btn" data-id="${id}">Return</button>
                <button class="btn btn-secondary btn-sm renew-loan-btn" data-id="${id}">Renew</button>
              ` : `
                <span class="text-xs text-muted">Completed</span>
              `}
            </div>
          </td>
        </tr>
      `;
    },

    /**
     * Reservation Table Row
     * @param {object} reservation 
     * @returns {string} HTML string
     */
    reservationRow(reservation = {}) {
      const id = reservation.id || reservation._id || '';
      const bookTitle = (reservation.book && reservation.book.title) || reservation.book_title || 'Book Title';
      const memberName = (reservation.user && reservation.user.name) || reservation.user_name || 'Member';
      const reserveDate = window.format ? window.format.date(reservation.created_at || reservation.reserved_at) : '—';
      const status = reservation.status || 'PENDING';
      const statusBadge = window.format ? window.format.statusBadge(status) : `<span class="badge">${status}</span>`;

      return `
        <tr data-reservation-id="${id}">
          <td class="font-semibold">${bookTitle}</td>
          <td>${memberName}</td>
          <td>${reserveDate}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              ${status === 'PENDING' ? `
                <button class="btn btn-danger btn-sm cancel-reservation-btn" data-id="${id}">Cancel</button>
                <button class="btn btn-success btn-sm fulfill-reservation-btn" data-id="${id}">Issue Book</button>
              ` : `
                <span class="text-xs text-muted">—</span>
              `}
            </div>
          </td>
        </tr>
      `;
    },

    /**
     * Fine Management Table Row
     * @param {object} fine 
     * @returns {string} HTML string
     */
    fineRow(fine = {}) {
      const id = fine.id || fine._id || '';
      const memberName = (fine.user && fine.user.name) || fine.user_name || 'Member';
      const amount = window.format ? window.format.currency(fine.amount) : `Rs. ${fine.amount}`;
      const reason = fine.reason || 'Overdue item fine';
      const status = fine.status || 'UNPAID';
      const statusBadge = window.format ? window.format.statusBadge(status) : `<span class="badge">${status}</span>`;

      return `
        <tr data-fine-id="${id}">
          <td class="font-semibold">${memberName}</td>
          <td><span class="font-bold text-danger">${amount}</span></td>
          <td class="text-xs">${reason}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              ${status === 'UNPAID' ? `
                <button class="btn btn-success btn-sm pay-fine-btn" data-id="${id}">Mark as Paid</button>
              ` : `
                <span class="text-xs text-muted">Paid</span>
              `}
            </div>
          </td>
        </tr>
      `;
    },

    /**
     * Review Card Component
     * @param {object} review 
     * @returns {string} HTML string
     */
    reviewCard(review = {}) {
      const userName = (review.user && review.user.name) || review.user_name || 'Anonymous Reader';
      const userAvatar = (review.user && review.user.avatar) || null;
      const avatarHtml = window.format ? window.format.avatar(userName, userAvatar, 'sm') : '';
      const rating = review.rating || 5;
      const starRatingHtml = window.format ? window.format.starRating(rating) : `★ ${rating}`;
      const comment = review.comment || review.content || '';
      const date = window.format ? window.format.relativeTime(review.created_at || review.createdAt) : 'recently';

      return `
        <div class="review-card card-enter">
          <div class="review-author-bar">
            <div class="flex-align-center gap-3">
              ${avatarHtml}
              <div class="flex-col">
                <span class="font-semibold text-sm" style="color: var(--text);">${userName}</span>
                <span class="text-xs text-muted">${date}</span>
              </div>
            </div>
            ${starRatingHtml}
          </div>
          <p class="text-sm" style="color: var(--text); margin-bottom: 0; line-height: var(--leading-relaxed);">${comment}</p>
        </div>
      `;
    },

    /**
     * Notification Item Component
     * @param {object} notification 
     * @returns {string} HTML string
     */
    notificationItem(notification = {}) {
      const id = notification.id || notification._id || '';
      const title = notification.title || 'Notification';
      const message = notification.message || '';
      const type = notification.type || 'info';
      const isRead = notification.is_read ?? notification.read ?? false;
      const time = window.format ? window.format.relativeTime(notification.created_at || notification.createdAt) : 'just now';
      const readClass = isRead ? 'read' : 'unread';

      return `
        <div class="activity-feed-item ${readClass}" data-notification-id="${id}">
          <div class="stat-icon ${type} sm" style="width: 2rem; height: 2rem; font-size: 1rem; border-radius: var(--radius-md);">
            ${window.navigation ? (window.navigation.icons[type] || window.navigation.icons.bell) : '🔔'}
          </div>
          <div class="flex-col flex-1">
            <div class="flex-between">
              <span class="font-semibold text-sm" style="color: var(--text);">${title}</span>
              <span class="text-xs text-muted">${time}</span>
            </div>
            <p class="text-xs text-secondary" style="margin-top: 2px; margin-bottom: 0;">${message}</p>
          </div>
        </div>
      `;
    },

    /**
     * Empty State Component
     * @param {string} icon 
     * @param {string} title 
     * @param {string} message 
     * @param {string} actionText 
     * @param {string} actionHref 
     * @returns {string} HTML string
     */
    emptyState(icon = 'book', title = 'No Items Found', message = 'There are currently no records to display.', actionText = '', actionHref = '') {
      const iconSvg = (typeof icon === 'string' && icon.startsWith('<svg')) ? icon : 
        ((window.navigation && window.navigation.icons[icon]) ? window.navigation.icons[icon] : `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`);

      return `
        <div class="empty-state">
          <div class="empty-state-icon">
            ${iconSvg}
          </div>
          <h3 class="empty-state-title">${title}</h3>
          <p class="empty-state-desc">${message}</p>
          ${actionText && actionHref ? `
            <a href="${actionHref}" class="btn btn-primary btn-md">
              <span>${actionText}</span>
            </a>
          ` : ''}
        </div>
      `;
    },

    /**
     * Loading Skeletons Generator
     * @param {'cards'|'rows'|'text'} type 
     * @param {number} count 
     * @returns {string} HTML string
     */
    loadingSkeleton(type = 'cards', count = 4) {
      let html = '';

      if (type === 'cards') {
        html += '<div class="books-grid">';
        for (let i = 0; i < count; i++) {
          html += `
            <div class="skeleton-card">
              <div class="skeleton skeleton-image" style="height: 220px; margin-bottom: 12px;"></div>
              <div class="skeleton skeleton-text title" style="margin-bottom: 8px;"></div>
              <div class="skeleton skeleton-text short" style="margin-bottom: 16px;"></div>
              <div class="skeleton skeleton-text" style="height: 36px; border-radius: var(--radius-md);"></div>
            </div>
          `;
        }
        html += '</div>';
        return html;
      }

      if (type === 'rows') {
        for (let i = 0; i < count; i++) {
          html += `
            <tr>
              <td><div class="skeleton skeleton-text" style="width: 140px;"></div></td>
              <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
              <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
              <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
              <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
              <td><div class="skeleton skeleton-text" style="width: 50px;"></div></td>
            </tr>
          `;
        }
        return html;
      }

      // Default text skeleton lines
      for (let i = 0; i < count; i++) {
        html += `<div class="skeleton skeleton-text" style="width: ${100 - (i * 12)}%;"></div>`;
      }
      return html;
    },

    /**
     * Breadcrumb navigation HTML
     * @param {Array<{label: string, href?: string}>} items 
     * @returns {string} HTML string
     */
    breadcrumb(items = []) {
      if (!items.length) return '';

      let html = '<ul class="breadcrumb" aria-label="Breadcrumb">';
      items.forEach((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          html += `<li class="breadcrumb-item active" aria-current="page">${item.label}</li>`;
        } else {
          html += `
            <li class="breadcrumb-item">
              <a href="${item.href || '#'}">${item.label}</a>
              <span class="breadcrumb-separator">/</span>
            </li>
          `;
        }
      });
      html += '</ul>';
      return html;
    },

    /**
     * Shelf Location Tag Badge
     */
    shelfLocationBadge(shelf) {
      const locationText = window.format ? window.format.shelfLocation(shelf) : 'Unassigned';
      return `
        <span class="badge badge-primary font-mono">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M4 6h16M4 12h16M4 18h16M6 4v16M18 4v16"/></svg>
          ${locationText}
        </span>
      `;
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.components = components;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = components;
  }
})();
