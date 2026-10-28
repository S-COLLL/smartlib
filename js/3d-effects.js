/**
 * SMARTLIB - 3D Interaction, Tilt, Parallax & Scroll Reveal Module
 * Provides fluid mouse-tracking 3D tilt, dynamic glares, parallax scrolling, and IntersectionObserver animations.
 */

(function () {
  'use strict';

  // Check prefers-reduced-motion
  const prefersReducedMotion = () => {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const activeCleanups = [];

  const effects = {
    /**
     * Mousemove 3D Tilt Effect on cards
     * @param {string|NodeList} selector 
     * @param {object} options 
     */
    initTiltEffect(selector = '.tilt-card, .book-card-3d', options = {}) {
      if (prefersReducedMotion()) return () => {};

      const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
      if (!elements || !elements.length) return () => {};

      const maxTilt = options.maxTilt || 6; // degrees
      const perspective = options.perspective || 1000;
      const cleanups = [];

      elements.forEach(card => {
        let isHovered = false;

        const onMouseEnter = () => {
          isHovered = true;
          card.style.transition = 'transform 120ms cubic-bezier(0.03, 0.98, 0.52, 0.99)';
        };

        const onMouseMove = (e) => {
          if (!isHovered) return;

          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const rotateX = ((y - centerY) / centerY) * -maxTilt;
          const rotateY = ((x - centerX) / centerX) * maxTilt;

          card.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(8px)`;

          // Dynamic Glare
          const glare = card.querySelector('.tilt-glare');
          if (glare) {
            const glareX = (x / rect.width) * 100;
            const glareY = (y / rect.height) * 100;
            glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 65%)`;
          }
        };

        const onMouseLeave = () => {
          isHovered = false;
          card.style.transition = 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)';
          card.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
        };

        card.addEventListener('mouseenter', onMouseEnter);
        card.addEventListener('mousemove', onMouseMove);
        card.addEventListener('mouseleave', onMouseLeave);

        cleanups.push(() => {
          card.removeEventListener('mouseenter', onMouseEnter);
          card.removeEventListener('mousemove', onMouseMove);
          card.removeEventListener('mouseleave', onMouseLeave);
        });
      });

      const cleanup = () => {
        cleanups.forEach(fn => fn());
      };
      activeCleanups.push(cleanup);
      return cleanup;
    },

    /**
     * Subtle Floating Animation for Hero Visuals
     * @param {string|NodeList} selector 
     */
    initFloatingAnimation(selector = '.hero-float') {
      if (prefersReducedMotion()) return () => {};

      const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
      if (!elements || !elements.length) return () => {};

      elements.forEach((el, index) => {
        el.style.animation = `hero-floating ${5 + (index * 0.7)}s ease-in-out ${index * 0.4}s infinite alternate`;
      });
    },

    /**
     * Scroll Reveal using IntersectionObserver
     * @param {string} selector 
     */
    initScrollReveal(selector = '.card-enter, .stat-card, .book-card-3d') {
      if (prefersReducedMotion()) {
        document.querySelectorAll(selector).forEach(el => {
          el.style.opacity = '1';
          el.style.transform = 'none';
        });
        return;
      }

      if (!('IntersectionObserver' in window)) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0) scale(1)';
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
      });

      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px) scale(0.97)';
        el.style.transition = 'opacity 500ms ease, transform 500ms cubic-bezier(0.16, 1, 0.3, 1)';
        observer.observe(el);
      });
    },

    /**
     * Subtle Parallax on scroll
     * @param {string} selector 
     */
    initParallax(selector = '.hero-visual-3d, .hero-glow-orb') {
      if (prefersReducedMotion()) return () => {};

      const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
      if (!elements || !elements.length) return () => {};

      const onScroll = () => {
        const scrolled = window.pageYOffset || document.documentElement.scrollTop;
        elements.forEach(el => {
          const speed = parseFloat(el.getAttribute('data-parallax-speed') || '0.15');
          el.style.transform = `translate3d(0, ${scrolled * speed}px, 0)`;
        });
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      activeCleanups.push(() => window.removeEventListener('scroll', onScroll));
    },

    /**
     * Clean up all active effect event listeners
     */
    cleanup() {
      while (activeCleanups.length) {
        const fn = activeCleanups.pop();
        if (typeof fn === 'function') fn();
      }
    },

    /**
     * Initialize all default 3D effects on page load
     */
    init() {
      this.initTiltEffect();
      this.initFloatingAnimation();
      this.initScrollReveal();
      this.initParallax();
    }
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.effects = effects;
    document.addEventListener('DOMContentLoaded', () => {
      effects.init();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = effects;
  }
})();
