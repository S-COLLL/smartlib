/**
 * SMARTLIB - Navigation Module & SVG Icon Library
 * Handles dynamic role-based sidebar rendering, top header, mobile nav, and collapsing.
 */

(function () {
  'use strict';

  // SVG Icon Library
  const icons = {
    home: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    book: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 2v20"/></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    map: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>`,
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    users: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    clipboard: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    bell: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    shelf: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16M6 4v16M18 4v16"/></svg>`,
    receipt: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-8"/><path d="M16 12h-8"/><path d="M12 16H8"/></svg>`,
    activity: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    edit: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
    filter: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
    sort: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>`,
    chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    arrow: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    eye: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    clock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    alert: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    barcode: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>`,
    grid: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
    list: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
    menu: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`
  };

  const navigation = {
    icons,

    /**
     * Get menu configuration by user role
     */
    getMenu(role) {
      const userRole = (role || 'PUBLIC').toUpperCase();

      if (userRole === 'ADMIN' || userRole === 'LIBRARIAN') {
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Dashboard', href: '/pages/admin-dashboard.html', icon: 'dashboard' },
              { label: 'Book Catalog', href: '/pages/admin-books.html', icon: 'book' },
              { label: 'Shelves & Map', href: '/pages/shelves.html', icon: 'shelf' }
            ]
          },
          {
            title: 'Circulation',
            items: [
              { label: 'Issue / Return', href: '/pages/issue-return.html', icon: 'barcode' },
              { label: 'Transactions', href: '/pages/transactions.html', icon: 'clipboard' },
              { label: 'Members', href: '/pages/members.html', icon: 'users' },
              { label: 'Fines Management', href: '/pages/fines.html', icon: 'receipt' }
            ]
          },
          {
            title: 'System',
            items: [
              { label: 'Activity Logs', href: '/pages/activity-logs.html', icon: 'activity' },
              { label: 'Profile Settings', href: '/pages/profile.html', icon: 'settings' }
            ]
          }
        ];
      }

      if (userRole === 'MEMBER') {
        return [
          {
            title: 'Discovery',
            items: [
              { label: 'Dashboard', href: '/pages/member-dashboard.html', icon: 'dashboard' },
              { label: 'Browse Catalog', href: '/pages/books.html', icon: 'book' },
              { label: 'Interactive Map', href: '/pages/library-map.html', icon: 'map' }
            ]
          },
          {
            title: 'My Account',
            items: [
              { label: 'My Borrowed Books', href: '/pages/my-books.html', icon: 'clipboard' },
              { label: 'Reservations', href: '/pages/reservations.html', icon: 'calendar' },
              { label: 'My Reviews', href: '/pages/reviews.html', icon: 'star' },
              { label: 'Notifications', href: '/pages/notifications.html', icon: 'bell' },
              { label: 'Profile', href: '/pages/profile.html', icon: 'user' }
            ]
          }
        ];
      }

      // Public / Guest
      return [
        {
          title: 'Explore',
          items: [
            { label: 'Home', href: '/pages/index.html', icon: 'home' },
            { label: 'Book Catalog', href: '/pages/books.html', icon: 'book' },
            { label: 'Library Map', href: '/pages/library-map.html', icon: 'map' }
          ]
        },
        {
          title: 'Account',
          items: [
            { label: 'Sign In', href: '/pages/login.html', icon: 'user' },
            { label: 'Register', href: '/pages/register.html', icon: 'plus' }
          ]
        }
      ];
    },

    /**
     * Render the sidebar into a target container
     * @param {HTMLElement|string} target 
     */
    renderSidebar(target = '#sidebar') {
      const container = typeof target === 'string' ? document.querySelector(target) : target;
      if (!container) return;

      const user = window.auth ? window.auth.getUser() : null;
      const role = user ? user.role : 'PUBLIC';
      const menu = this.getMenu(role);
      const currentPath = window.location.pathname;

      let navHtml = '';
      menu.forEach(group => {
        navHtml += `<div class="sidebar-group-title">${group.title}</div>`;
        group.items.forEach(item => {
          const isActive = currentPath.endsWith(item.href) || 
            (item.href === '/index.html' && (currentPath === '/' || currentPath === ''));
          const activeClass = isActive ? ' active' : '';
          const iconSvg = icons[item.icon] || icons.book;

          navHtml += `
            <a href="${item.href}" class="sidebar-link${activeClass}" data-page="${item.href}">
              <span class="link-icon">${iconSvg}</span>
              <span class="link-text">${item.label}</span>
            </a>
          `;
        });
      });

      const userAvatar = user ? (window.format ? window.format.avatar(user.name || user.email) : `<div class="avatar avatar-sm">${(user.name || 'U').charAt(0).toUpperCase()}</div>`) : '';
      const userName = user ? (user.name || user.email) : 'Guest User';
      const userRoleLabel = user ? user.role : 'Visitor';

      const sidebarHtml = `
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">${icons.book}</div>
          <span class="sidebar-logo-text">SMART<span>LIB</span></span>
        </div>
        <nav class="sidebar-nav" role="navigation" aria-label="Main Navigation">
          ${navHtml}
        </nav>
        <div class="sidebar-footer">
          ${user ? `
            <div class="flex-align-center gap-3 flex-1">
              ${userAvatar}
              <div class="sidebar-user-details flex-col">
                <span class="text-sm font-semibold" style="color: #fff; line-height: 1.2;">${userName}</span>
                <span class="text-xs" style="color: var(--accent-light);">${userRoleLabel}</span>
              </div>
            </div>
            <button class="btn btn-icon btn-ghost" id="nav-logout-btn" title="Logout" style="color: var(--accent-light);">
              ${icons.logout}
            </button>
          ` : `
            <a href="/pages/login.html" class="btn btn-primary btn-sm btn-full">
              <span>Sign In</span>
            </a>
          `}
        </div>
      `;

      container.innerHTML = sidebarHtml;
      container.classList.add('sidebar');

      // Bind logout handler
      const logoutBtn = container.querySelector('#nav-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (window.auth) window.auth.logout();
        });
      }
    },

    /**
     * Render the top header
     * @param {HTMLElement|string} target 
     */
    renderHeader(target = '#top-header') {
      const container = typeof target === 'string' ? document.querySelector(target) : target;
      if (!container) return;

      const user = window.auth ? window.auth.getUser() : null;
      const userName = user ? (user.name || user.email) : 'Sign In';

      const headerHtml = `
        <div class="header-left">
          <button class="btn btn-icon btn-ghost" id="sidebar-toggle-btn" aria-label="Toggle Sidebar">
            ${icons.menu}
          </button>
          <div class="search-bar d-none d-md-block">
            <span class="search-icon">${icons.search}</span>
            <input type="text" class="form-control" id="header-quick-search" placeholder="Quick search title, author, ISBN..." />
          </div>
        </div>
        <div class="header-right">
          ${user ? `
            <a href="/pages/notifications.html" class="btn btn-icon btn-ghost notification-btn" title="Notifications" aria-label="Notifications">
              ${icons.bell}
              <span class="notification-badge" id="header-notification-indicator" style="display:none;"></span>
            </a>
            <a href="/pages/profile.html" class="flex-align-center gap-2" style="text-decoration:none;">
              ${window.format ? window.format.avatar(user.name || user.email) : `<div class="avatar avatar-sm">${(user.name || 'U').charAt(0).toUpperCase()}</div>`}
              <span class="text-sm font-semibold d-none d-sm-inline" style="color: var(--text);">${userName}</span>
            </a>
          ` : `
            <a href="/pages/login.html" class="btn btn-ghost btn-sm">Sign In</a>
            <a href="/pages/register.html" class="btn btn-primary btn-sm">Get Started</a>
          `}
        </div>
      `;

      container.innerHTML = headerHtml;
      container.classList.add('top-header');

      // Setup toggle button
      const toggleBtn = container.querySelector('#sidebar-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          this.toggleSidebar();
        });
      }

      // Quick search redirect
      const quickSearch = container.querySelector('#header-quick-search');
      if (quickSearch) {
        quickSearch.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && quickSearch.value.trim()) {
            window.location.href = `/pages/books.html?q=${encodeURIComponent(quickSearch.value.trim())}`;
          }
        });
      }
    },

    /**
     * Render mobile bottom navigation bar
     * @param {HTMLElement|string} target 
     */
    renderMobileNav(target = '#mobile-nav') {
      let container = typeof target === 'string' ? document.querySelector(target) : target;
      if (!container) {
        container = document.createElement('nav');
        container.id = 'mobile-nav';
        container.className = 'mobile-nav';
        document.body.appendChild(container);
      }

      const user = window.auth ? window.auth.getUser() : null;
      const currentPath = window.location.pathname;
      const isStaff = user && (user.role === 'ADMIN' || user.role === 'LIBRARIAN');

      const links = isStaff ? [
        { label: 'Admin', href: '/pages/admin-dashboard.html', icon: 'dashboard' },
        { label: 'Books', href: '/pages/admin-books.html', icon: 'book' },
        { label: 'Issue/Return', href: '/pages/issue-return.html', icon: 'barcode' },
        { label: 'Members', href: '/pages/members.html', icon: 'users' },
        { label: 'Profile', href: '/pages/profile.html', icon: 'user' }
      ] : (user ? [
        { label: 'Dashboard', href: '/pages/member-dashboard.html', icon: 'dashboard' },
        { label: 'Books', href: '/pages/books.html', icon: 'book' },
        { label: 'Map', href: '/pages/library-map.html', icon: 'map' },
        { label: 'My Books', href: '/pages/my-books.html', icon: 'clipboard' },
        { label: 'Profile', href: '/pages/profile.html', icon: 'user' }
      ] : [
        { label: 'Home', href: '/pages/index.html', icon: 'home' },
        { label: 'Books', href: '/pages/books.html', icon: 'book' },
        { label: 'Map', href: '/pages/library-map.html', icon: 'map' },
        { label: 'Sign In', href: '/pages/login.html', icon: 'user' }
      ]);

      let html = '';
      links.forEach(l => {
        const isActive = currentPath.endsWith(l.href);
        html += `
          <a href="${l.href}" class="mobile-nav-link${isActive ? ' active' : ''}">
            ${icons[l.icon] || icons.home}
            <span>${l.label}</span>
          </a>
        `;
      });

      container.innerHTML = html;
    },

    /**
     * Toggle sidebar collapsed or mobile open state
     */
    toggleSidebar() {
      const sidebar = document.querySelector('.sidebar');
      const layout = document.querySelector('.app-layout');
      
      if (!sidebar) return;

      if (window.innerWidth <= 767) {
        // Mobile drawer toggle
        const isOpen = sidebar.classList.toggle('mobile-open');
        document.body.classList.toggle('sidebar-open', isOpen);
        
        let backdrop = document.querySelector('.sidebar-backdrop');
        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.className = 'sidebar-backdrop';
          document.body.appendChild(backdrop);
          backdrop.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            document.body.classList.remove('sidebar-open');
          });
        }
      } else {
        // Desktop collapse toggle
        const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
        if (layout) {
          layout.classList.toggle('sidebar-is-collapsed', isCollapsed);
        }
        localStorage.setItem('smartlib_sidebar_collapsed', isCollapsed ? 'true' : 'false');
      }
    },

    /**
     * Initialize navigation components on page load
     */
    init() {
      if (document.querySelector('#sidebar')) {
        this.renderSidebar('#sidebar');
      }
      if (document.querySelector('#top-header')) {
        this.renderHeader('#top-header');
      }
      this.renderMobileNav();

      // Restore desktop collapse preference
      if (window.innerWidth > 767 && localStorage.getItem('smartlib_sidebar_collapsed') === 'true') {
        const sidebar = document.querySelector('.sidebar');
        const layout = document.querySelector('.app-layout');
        if (sidebar) sidebar.classList.add('sidebar-collapsed');
        if (layout) layout.classList.add('sidebar-is-collapsed');
      }

      // Listen for auth changes to re-render nav
      window.addEventListener('authChanged', () => {
        this.renderSidebar('#sidebar');
        this.renderHeader('#top-header');
        this.renderMobileNav();
      });
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.navigation = navigation;
    document.addEventListener('DOMContentLoaded', () => {
      navigation.init();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = navigation;
  }
})();
