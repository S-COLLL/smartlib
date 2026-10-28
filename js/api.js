/**
 * SMARTLIB - API Client Module
 * Handles HTTP requests, JWT token attachment, 401 auto-redirection, and file uploads.
 */

(function () {
  'use strict';

  const getApiBase = () => {
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      // If running from file:// or another local dev server (e.g. Live Server on 5500, 8080, etc.), route to backend
      if (window.location.protocol === 'file:' || (port && port !== '3000' && port !== '5000')) {
        return 'http://localhost:3000/api/v1';
      }
    }
    return '/api/v1';
  };

  const api = {
    /**
     * Base request dispatcher
     * @param {string} endpoint 
     * @param {RequestInit} options 
     * @returns {Promise<any>}
     */
    async request(endpoint, options = {}) {
      const base = getApiBase();
      const url = `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const token = localStorage.getItem('smartlib_token');
      
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers
        });

        let data = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = { message: text };
        }

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('smartlib_token');
            localStorage.removeItem('smartlib_user');
            if (typeof window !== 'undefined' && !window.location.pathname.includes('login')) {
              window.location.href = '/pages/login.html';
            }
          }
          throw { status: response.status, ...data };
        }

        return data;
      } catch (err) {
        if (err && err.status) {
          throw err;
        }
        // Network or parse error
        throw { status: 0, message: err.message || 'Network connection failed' };
      }
    },

    /**
     * GET request with query parameter serialization
     */
    get(endpoint, params) {
      let query = '';
      if (params) {
        const filteredParams = {};
        Object.keys(params).forEach(key => {
          if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            filteredParams[key] = params[key];
          }
        });
        const qs = new URLSearchParams(filteredParams).toString();
        if (qs) query = '?' + qs;
      }
      return api.request(endpoint + query, { method: 'GET' });
    },

    /**
     * POST request
     */
    post(endpoint, body) {
      return api.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },

    /**
     * PUT request
     */
    put(endpoint, body) {
      return api.request(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
    },

    /**
     * PATCH request
     */
    patch(endpoint, body) {
      return api.request(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
    },

    /**
     * DELETE request
     */
    delete(endpoint) {
      return api.request(endpoint, { method: 'DELETE' });
    },

    /**
     * Multipart file upload (skips json content type header)
     */
    async upload(endpoint, formData) {
      const url = `${getApiBase()}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const token = localStorage.getItem('smartlib_token');
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData
        });

        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('smartlib_token');
            localStorage.removeItem('smartlib_user');
            if (typeof window !== 'undefined' && !window.location.pathname.includes('login')) {
              window.location.href = '/pages/login.html';
            }
          }
          throw { status: response.status, ...data };
        }
        return data;
      } catch (err) {
        if (err && err.status) throw err;
        throw { status: 0, message: err.message || 'File upload failed' };
      }
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.api = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
