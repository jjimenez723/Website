// nav-mobile.js – mobile off-canvas navigation logic
// Runs after DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
  const btn   = document.getElementById('navToggle');
  const panel = document.getElementById('mobileNav');
  const ovly  = document.getElementById('navOverlay');

  if (!btn || !panel || !ovly) return;

  const focusSelector = 'a, button';
  let focusEls = [];

  let isOpen = false; // state flag

  const openMenu = () => {
    if (isOpen) return;
    panel.classList.add('is-open');
    ovly.classList.add('is-open');
    ovly.hidden = false;
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    // collect focusable elements each time
    focusEls = Array.from(panel.querySelectorAll(focusSelector));
    focusEls[0]?.focus();
    // lock background scroll
    document.body.style.overflow = 'hidden';
    isOpen = true;
  };

  const closeMenu = () => {
    if (!isOpen) return;
    panel.classList.remove('is-open');
    ovly.classList.remove('is-open');
    setTimeout(() => { ovly.hidden = true; }, 350); // wait for fade
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
    document.body.style.overflow = '';
    isOpen = false;
  };

  // click toggle
  btn.addEventListener('click', () => {
    isOpen ? closeMenu() : openMenu();
  });

  // click overlay to close
  ovly.addEventListener('click', closeMenu);

  // click nav link closes
  panel.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') closeMenu();
  });

  // keyboard interactions
  document.addEventListener('keydown', (e) => {
    if (!panel.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      closeMenu();
      return;
    }
    if (e.key === 'Tab') {
      // focus trap
      const first = focusEls[0];
      const last  = focusEls[focusEls.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}); 