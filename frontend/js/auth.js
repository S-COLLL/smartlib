/**
 * SMARTLIB - Authentication & Authorization Module
 * Manages user sessions, JWT tokens, role validation, and route guards.
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'smartlib_token';
  const USER_KEY = 'smartlib_user';

  const auth = {
    /**
     * Authenticate user with email and password
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<any>}
     */
    async login(email, password) {
      const data = await window.api.post('/auth/login', { email, password });
      
      if (data && (data.token || (data.data && data.data.token))) {
        const token = data.token || data.data.token;
        const user = data.user || data.data.user;
        
        localStorage.setItem(TOKEN_KEY, token);
        if (user) {
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        
        this._dispatchAuthChange('login', user);
      }
      return data;
    },

    /**
     * Register a new user account
     * @param {object} userData 
     * @returns {Promise<any>}
     */
    async register(userData) {
      const data = await window.api.post('/auth/register', userData);
      
      if (data && (data.token || (data.data && data.data.token))) {
        const token = data.token || data.data.token;
        const user = data.user || data.data.user;
        
        localStorage.setItem(TOKEN_KEY, token);
        if (user) {
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        
        this._dispatchAuthChange('register', user);
      }
      return data;
    },

    /**
     * Log out current user and clear local cache
     */
    async logout(redirect = true) {
      try {
        if (window.api && this.getToken()) {
          await window.api.post('/auth/logout', {}).catch(() => {});
        }
      } catch (e) {
        // Ignore network failures on logout
      } finally {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        this._dispatchAuthChange('logout', null);
        
        if (redirect && typeof window !== 'undefined') {
          window.location.href = '/pages/login.html';
        }
      }
    },

    /**
     * Retrieve the currently logged in user profile object
     * @returns {object|null}
     */
    getUser() {
      try {
        const userStr = localStorage.getItem(USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        console.error('Error parsing stored user data:', e);
        return null;
      }
    },

    /**
     * Retrieve the stored JWT token
     * @returns {string|null}
     */
    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isAuthenticated() {
      return !!this.getToken();
    },

    /**
     * Check if current user is an Administrator
     * @returns {boolean}
     */
    isAdmin() {
      const user = this.getUser();
      return !!(user && (user.role === 'ADMIN' || user.role === 'admin'));
    },

    /**
     * Check if current user is a Librarian or Admin
     * @returns {boolean}
     */
    isLibrarian() {
      const user = this.getUser();
      if (!user) return false;
      const role = (user.role || '').toUpperCase();
      return role === 'LIBRARIAN' || role === 'ADMIN';
    },

    /**
     * Check if current user is a regular Member
     * @returns {boolean}
     */
    isMember() {
      const user = this.getUser();
      if (!user) return false;
      const role = (user.role || '').toUpperCase();
      return role === 'MEMBER';
    },

    /**
     * Guard route by requiring authentication and optional roles
     * @param {string[]|string} [requiredRoles] - e.g. ['ADMIN', 'LIBRARIAN']
     * @returns {boolean}
     */
    requireAuth(requiredRoles = null) {
      if (!this.isAuthenticated()) {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/pages/login.html?redirect=${encodeURIComponent(currentPath)}`;
        return false;
      }

      if (requiredRoles) {
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
        const user = this.getUser();
        const userRole = (user && user.role ? user.role : '').toUpperCase();
        
        const hasRole = roles.map(r => r.toUpperCase()).includes(userRole);
        if (!hasRole) {
          // If admin is required and user is not, send to appropriate dashboard
          if (this.isMember()) {
            window.location.href = '/pages/member-dashboard.html';
          } else {
            window.location.href = '/pages/books.html';
          }
          return false;
        }
      }

      return true;
    },

    /**
     * Update stored user details locally and trigger change event
     * @param {object} updatedData 
     */
    updateUser(updatedData) {
      const current = this.getUser() || {};
      const merged = { ...current, ...updatedData };
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
      this._dispatchAuthChange('update', merged);
      return merged;
    },

    /**
     * Internal event dispatcher
     */
    _dispatchAuthChange(action, user) {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('authChanged', {
          detail: { action, user, isAuthenticated: !!this.getToken() }
        });
        window.dispatchEvent(event);
      }
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.auth = auth;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
  }
})();
