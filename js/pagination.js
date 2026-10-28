/**
 * SMARTLIB - Pagination UI & Navigation Component
 * Renders smart numbered page controls with ellipsis, prev/next arrows, and click handlers.
 */

(function () {
  'use strict';

  const pagination = {
    /**
     * Compute array of page numbers and ellipsis tokens
     * e.g. [1, '...', 4, 5, 6, '...', 20]
     */
    getPageNumbers(currentPage, totalPages, delta = 2) {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const pages = [];
      const left = Math.max(2, currentPage - delta);
      const right = Math.min(totalPages - 1, currentPage + delta);

      pages.push(1);

      if (left > 2) {
        pages.push('...');
      }

      for (let i = left; i <= right; i++) {
        pages.push(i);
      }

      if (right < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
      return pages;
    },

    /**
     * Render pagination buttons into a container element
     * @param {HTMLElement|string} container 
     * @param {object} options - { currentPage, totalPages, onPageChange }
     */
    render(container, options = {}) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;

      const currentPage = Number(options.currentPage) || 1;
      const totalPages = Number(options.totalPages) || 1;
      const onPageChange = typeof options.onPageChange === 'function' ? options.onPageChange : () => {};

      if (totalPages <= 1) {
        el.innerHTML = '';
        return;
      }

      const pageTokens = this.getPageNumbers(currentPage, totalPages);

      let html = '<nav class="pagination" role="navigation" aria-label="Pagination">';

      // Previous button
      const prevDisabled = currentPage <= 1 ? ' disabled' : '';
      html += `
        <button class="page-btn page-btn-prev"${prevDisabled} aria-label="Previous page" data-page="${currentPage - 1}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      `;

      // Page numbers
      pageTokens.forEach(token => {
        if (token === '...') {
          html += `<span class="page-ellipsis">&hellip;</span>`;
        } else {
          const isActive = token === currentPage ? ' active' : '';
          const ariaCurrent = token === currentPage ? ' aria-current="page"' : '';
          html += `
            <button class="page-btn${isActive}"${ariaCurrent} data-page="${token}">
              ${token}
            </button>
          `;
        }
      });

      // Next button
      const nextDisabled = currentPage >= totalPages ? ' disabled' : '';
      html += `
        <button class="page-btn page-btn-next"${nextDisabled} aria-label="Next page" data-page="${currentPage + 1}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      `;

      html += '</nav>';
      el.innerHTML = html;

      // Event delegation for clicks
      const buttons = el.querySelectorAll('.page-btn:not([disabled])');
      buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetPage = Number(btn.getAttribute('data-page'));
          if (targetPage && targetPage !== currentPage && targetPage >= 1 && targetPage <= totalPages) {
            onPageChange(targetPage);
          }
        });
      });
    }
  };

  // Alias renderPagination to render
  pagination.renderPagination = pagination.render;

  // Expose to window
  if (typeof window !== 'undefined') {
    window.pagination = pagination;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = pagination;
  }
})();
