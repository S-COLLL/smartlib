/**
 * SMARTLIB - Accessible Modal & Dialog Module
 * Provides programmatically controlled modals, promise-based alerts/confirms, focus trapping, and backdrop locking.
 */

(function () {
  'use strict';

  let activeOverlay = null;
  let previousActiveElement = null;
  let activeKeyHandler = null;

  const modal = {
    /**
     * Open a custom modal dialog
     * @param {object} options
     * @returns {HTMLElement}
     */
    open(options = {}) {
      this.close(); // Close any currently open modal

      const {
        title = '',
        content = '',
        size = 'md', // sm, md, lg, xl
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        confirmClass = 'btn-primary',
        showCancel = true,
        hideFooter = false,
        onConfirm = null,
        onCancel = null
      } = options;

      previousActiveElement = document.activeElement;

      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'modal-dialog-title');

      const sizeClass = size === 'md' ? '' : ` modal-${size}`;

      overlay.innerHTML = `
        <div class="modal${sizeClass}">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-dialog-title">${title}</h3>
            <button class="modal-close" aria-label="Close dialog">&times;</button>
          </div>
          <div class="modal-body">
            ${typeof content === 'string' ? content : ''}
          </div>
          ${!hideFooter ? `
            <div class="modal-footer">
              ${showCancel ? `<button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>` : ''}
              <button class="btn ${confirmClass}" id="modal-confirm-btn">${confirmText}</button>
            </div>
          ` : ''}
        </div>
      `;

      if (content instanceof HTMLElement) {
        overlay.querySelector('.modal-body').appendChild(content);
      }

      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');
      activeOverlay = overlay;

      // Animation trigger
      requestAnimationFrame(() => {
        overlay.classList.add('active');
      });

      // Events
      const closeBtn = overlay.querySelector('.modal-close');
      const cancelBtn = overlay.querySelector('#modal-cancel-btn');
      const confirmBtn = overlay.querySelector('#modal-confirm-btn');

      const handleClose = (confirmed) => {
        if (confirmed && onConfirm) {
          const res = onConfirm();
          if (res === false) return; // Allow canceling closure if validation fails
        }
        if (!confirmed && onCancel) {
          onCancel();
        }
        this.close();
      };

      if (closeBtn) closeBtn.addEventListener('click', () => handleClose(false));
      if (cancelBtn) cancelBtn.addEventListener('click', () => handleClose(false));
      if (confirmBtn) confirmBtn.addEventListener('click', () => handleClose(true));

      // Click outside backdrop
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          handleClose(false);
        }
      });

      // Keyboard trap & ESC listener
      activeKeyHandler = (e) => {
        if (e.key === 'Escape') {
          handleClose(false);
          return;
        }

        if (e.key === 'Tab') {
          const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
          } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      };
      document.addEventListener('keydown', activeKeyHandler);

      // Focus first interactive control
      setTimeout(() => {
        const firstInput = overlay.querySelector('input:not([type="hidden"]), select, textarea, #modal-confirm-btn');
        if (firstInput) firstInput.focus();
      }, 50);

      return overlay;
    },

    /**
     * Promise-based Confirmation Dialog
     * @returns {Promise<boolean>}
     */
    confirm(title, message, options = {}) {
      return new Promise((resolve) => {
        this.open({
          title,
          content: `<p class="text-sm" style="color: var(--text-secondary); margin:0;">${message}</p>`,
          size: options.size || 'sm',
          confirmText: options.confirmText || 'Yes, Proceed',
          cancelText: options.cancelText || 'Cancel',
          confirmClass: options.confirmClass || 'btn-primary',
          showCancel: true,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
    },

    /**
     * Promise-based Alert Dialog
     * @returns {Promise<void>}
     */
    alert(title, message, options = {}) {
      return new Promise((resolve) => {
        this.open({
          title,
          content: `<p class="text-sm" style="color: var(--text-secondary); margin:0;">${message}</p>`,
          size: options.size || 'sm',
          confirmText: options.confirmText || 'OK',
          showCancel: false,
          onConfirm: () => resolve(),
          onCancel: () => resolve()
        });
      });
    },

    /**
     * Close the currently open modal
     */
    close() {
      if (!activeOverlay) return;

      const overlay = activeOverlay;
      overlay.classList.remove('active');

      if (activeKeyHandler) {
        document.removeEventListener('keydown', activeKeyHandler);
        activeKeyHandler = null;
      }

      document.body.classList.remove('modal-open');

      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 250);

      activeOverlay = null;

      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.modal = modal;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = modal;
  }
})();
