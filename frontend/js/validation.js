/**
 * SMARTLIB - Form Validation & Error Highlighting Module
 * Rules for Email, Passwords, ISBN-10/13, Phone, Lengths, and automated DOM error feedback.
 */

(function () {
  'use strict';

  const validate = {
    /**
     * Check if value is present and non-empty
     */
    required(value) {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },

    /**
     * Check valid email format
     */
    email(value) {
      if (!value) return false;
      const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
      return re.test(String(value).trim());
    },

    /**
     * Minimum string length
     */
    minLength(value, min) {
      if (!value) return false;
      return String(value).trim().length >= min;
    },

    /**
     * Maximum string length
     */
    maxLength(value, max) {
      if (!value) return true;
      return String(value).trim().length <= max;
    },

    /**
     * Password standard: min 6 characters
     */
    password(value, min = 6) {
      if (!value) return false;
      return String(value).length >= min;
    },

    /**
     * Value equality (e.g. password confirmation)
     */
    match(value1, value2) {
      return value1 === value2;
    },

    /**
     * Phone number format (supports international formats, 7 to 15 digits)
     */
    phone(value) {
      if (!value) return false;
      const cleaned = String(value).replace(/[\s\-\(\)\+]/g, '');
      return /^\d{7,15}$/.test(cleaned);
    },

    /**
     * ISBN-10 or ISBN-13 format validation
     */
    isbn(value) {
      if (!value) return false;
      const cleaned = String(value).replace(/[-\s]/g, '').toUpperCase();

      if (cleaned.length === 10) {
        // ISBN-10 check digit verification
        let sum = 0;
        for (let i = 0; i < 9; i++) {
          const digit = parseInt(cleaned[i], 10);
          if (isNaN(digit)) return false;
          sum += digit * (10 - i);
        }
        const lastChar = cleaned[9];
        const check = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
        if (isNaN(check)) return false;
        sum += check;
        return sum % 11 === 0;
      }

      if (cleaned.length === 13) {
        // ISBN-13 check digit verification
        if (!cleaned.startsWith('978') && !cleaned.startsWith('979')) return false;
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          const digit = parseInt(cleaned[i], 10);
          if (isNaN(digit)) return false;
          sum += (i % 2 === 0 ? 1 : 3) * digit;
        }
        const check = parseInt(cleaned[12], 10);
        if (isNaN(check)) return false;
        const remainder = sum % 10;
        const expectedCheck = remainder === 0 ? 0 : 10 - remainder;
        return check === expectedCheck;
      }

      return false;
    },

    /**
     * Numeric range check
     */
    number(value, min = -Infinity, max = Infinity) {
      if (value === null || value === undefined || value === '') return false;
      const num = Number(value);
      if (isNaN(num)) return false;
      return num >= min && num <= max;
    },

    /**
     * URL validation
     */
    url(value) {
      if (!value) return false;
      try {
        new URL(value);
        return true;
      } catch (_) {
        return false;
      }
    },

    /**
     * Render error text on a form field
     * @param {HTMLElement|string} field 
     * @param {string} message 
     */
    showFieldError(field, message) {
      const el = typeof field === 'string' ? document.querySelector(field) : field;
      if (!el) return;

      el.classList.add('is-invalid');
      const parent = el.closest('.form-group') || el.parentElement;
      if (!parent) return;

      let errorEl = parent.querySelector('.form-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        parent.appendChild(errorEl);
      }
      errorEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${message}</span>
      `;
    },

    /**
     * Clear error highlight and text from a form field
     * @param {HTMLElement|string} field 
     */
    clearFieldError(field) {
      const el = typeof field === 'string' ? document.querySelector(field) : field;
      if (!el) return;

      el.classList.remove('is-invalid');
      const parent = el.closest('.form-group') || el.parentElement;
      if (parent) {
        const errorEl = parent.querySelector('.form-error');
        if (errorEl) {
          parent.removeChild(errorEl);
        }
      }
    },

    /**
     * Clear all field errors within a form
     * @param {HTMLFormElement|string} form 
     */
    clearAllErrors(form) {
      const formEl = typeof form === 'string' ? document.querySelector(form) : form;
      if (!formEl) return;

      formEl.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
      formEl.querySelectorAll('.form-error').forEach(el => el.remove());
    },

    /**
     * Validate an entire form against rules
     * @param {HTMLFormElement|string} formElement 
     * @param {object} rules - e.g. { email: { required: true, email: true }, password: { minLength: 6 } }
     * @returns {boolean}
     */
    validateForm(formElement, rules) {
      const form = typeof formElement === 'string' ? document.querySelector(formElement) : formElement;
      if (!form) return false;

      this.clearAllErrors(form);
      let isValid = true;
      let firstInvalidInput = null;

      for (const [fieldName, fieldRules] of Object.entries(rules)) {
        const input = form.querySelector(`[name="${fieldName}"]`) || form.querySelector(`#${fieldName}`);
        if (!input) continue;

        const val = input.value;

        // Required
        if (fieldRules.required && !this.required(val)) {
          this.showFieldError(input, fieldRules.requiredMessage || 'This field is required');
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // Skip subsequent checks if not required and empty
        if (!fieldRules.required && (!val || val.trim() === '')) {
          continue;
        }

        // Email
        if (fieldRules.email && !this.email(val)) {
          this.showFieldError(input, fieldRules.emailMessage || 'Please enter a valid email address');
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // Min length
        if (fieldRules.minLength && !this.minLength(val, fieldRules.minLength)) {
          this.showFieldError(input, fieldRules.minLengthMessage || `Must be at least ${fieldRules.minLength} characters`);
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // Max length
        if (fieldRules.maxLength && !this.maxLength(val, fieldRules.maxLength)) {
          this.showFieldError(input, fieldRules.maxLengthMessage || `Cannot exceed ${fieldRules.maxLength} characters`);
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // Password
        if (fieldRules.password && !this.password(val, fieldRules.min || 6)) {
          this.showFieldError(input, fieldRules.passwordMessage || 'Password must be at least 6 characters');
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // Match
        if (fieldRules.match) {
          const matchTarget = form.querySelector(`[name="${fieldRules.match}"]`) || form.querySelector(`#${fieldRules.match}`);
          if (matchTarget && !this.match(val, matchTarget.value)) {
            this.showFieldError(input, fieldRules.matchMessage || 'Values do not match');
            isValid = false;
            if (!firstInvalidInput) firstInvalidInput = input;
            continue;
          }
        }

        // Phone
        if (fieldRules.phone && !this.phone(val)) {
          this.showFieldError(input, fieldRules.phoneMessage || 'Please enter a valid telephone number');
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // ISBN
        if (fieldRules.isbn && !this.isbn(val)) {
          this.showFieldError(input, fieldRules.isbnMessage || 'Please enter a valid ISBN-10 or ISBN-13');
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }

        // Number range
        if (fieldRules.number && !this.number(val, fieldRules.min, fieldRules.max)) {
          this.showFieldError(input, fieldRules.numberMessage || 'Please enter a valid number in range');
          isValid = false;
          if (!firstInvalidInput) firstInvalidInput = input;
          continue;
        }
      }

      if (firstInvalidInput) {
        firstInvalidInput.focus();
      }

      return isValid;
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.validate = validate;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = validate;
  }
})();
