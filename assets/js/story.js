document.addEventListener('DOMContentLoaded', () => {
  const chapters = document.querySelectorAll('.chapter');
  const icons = document.querySelectorAll('.chapter .icon');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        const idx = Array.from(chapters).indexOf(e.target);
        icons[idx]?.classList.add('active');
      }
    });
  }, { rootMargin: '-10% 0px', threshold: 0.15 });
  chapters.forEach(ch => io.observe(ch));
}); 