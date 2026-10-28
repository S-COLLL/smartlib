/**
 * SMARTLIB - Toast Notification Module
 * Manages floating feedback messages with auto-dismiss, progress bars, and stacked queues.
 */

(function () {
  'use strict';

  const MAX_TOASTS = 5;
  const DEFAULT_DURATION = 4000;

  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  const toast = {
    _container: null,

    /**
     * Ensure the container DOM element exists
     */
    _getContainer() {
      if (!this._container || !document.body.contains(this._container)) {
        let container = document.querySelector('.toast-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'toast-container';
          container.setAttribute('aria-live', 'polite');
          document.body.appendChild(container);
        }
        this._container = container;
      }
      return this._container;
    },

    /**
     * Base show toast method
     */
    show(type = 'info', title = '', message = '', duration = DEFAULT_DURATION) {
      const container = this._getContainer();

      // Enforce max count
      const activeToasts = container.querySelectorAll('.toast');
      if (activeToasts.length >= MAX_TOASTS) {
        this.dismiss(activeToasts[0]);
      }

      const toastEl = document.createElement('div');
      toastEl.className = `toast toast-${type}`;
      toastEl.setAttribute('role', 'alert');

      const iconSvg = icons[type] || icons.info;

      toastEl.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <div class="toast-content">
          ${title ? `<div class="toast-title">${title}</div>` : ''}
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" aria-label="Close">&times;</button>
        <div class="toast-progress">
          <div class="toast-progress-bar"></div>
        </div>
      `;

      container.appendChild(toastEl);

      // Trigger animation on next tick
      requestAnimationFrame(() => {
        toastEl.classList.add('show');
      });

      // Animate progress bar
      const progressBar = toastEl.querySelector('.toast-progress-bar');
      if (progressBar && duration > 0) {
        progressBar.style.transition = `transform ${duration}ms linear`;
        requestAnimationFrame(() => {
          progressBar.style.transform = 'scaleX(0)';
        });
      }

      // Close button event
      const closeBtn = toastEl.querySelector('.toast-close');
      closeBtn.addEventListener('click', () => {
        this.dismiss(toastEl);
      });

      // Auto dismiss timer
      let dismissTimer = null;
      if (duration > 0) {
        dismissTimer = setTimeout(() => {
          this.dismiss(toastEl);
        }, duration);
      }

      // Pause on hover
      toastEl.addEventListener('mouseenter', () => {
        if (dismissTimer) clearTimeout(dismissTimer);
        if (progressBar) progressBar.style.transitionPlayState = 'paused';
      });

      toastEl.addEventListener('mouseleave', () => {
        if (duration > 0) {
          dismissTimer = setTimeout(() => {
            this.dismiss(toastEl);
          }, 1500);
        }
      });

      return toastEl;
    },

    /**
     * Remove a toast element smoothly
     */
    dismiss(toastEl) {
      if (!toastEl) return;
      toastEl.classList.remove('show');
      setTimeout(() => {
        if (toastEl.parentNode) {
          toastEl.parentNode.removeChild(toastEl);
        }
      }, 300);
    },

    /**
     * Success notification
     */
    success(message, duration = DEFAULT_DURATION, title = 'Success') {
      return this.show('success', title, message, duration);
    },

    /**
     * Error notification
     */
    error(message, duration = DEFAULT_DURATION, title = 'Error') {
      return this.show('error', title, message, duration);
    },

    /**
     * Warning notification
     */
    warning(message, duration = DEFAULT_DURATION, title = 'Attention') {
      return this.show('warning', title, message, duration);
    },

    /**
     * Info notification
     */
    info(message, duration = DEFAULT_DURATION, title = 'Information') {
      return this.show('info', title, message, duration);
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.toast = toast;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = toast;
  }
})();
