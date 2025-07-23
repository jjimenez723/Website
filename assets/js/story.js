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

  /* Position storyline so its start aligns with center of Chapter 1 */
  const storyline = document.querySelector('.storyline');
  const firstChapter = chapters[0];
  const mainEl = document.querySelector('main');
  const alignStoryline = () => {
    if (!storyline || !firstChapter) return;
    const offset = firstChapter.offsetTop + firstChapter.offsetHeight / 2 - mainEl.offsetTop;
    storyline.style.top = offset + 'px';
  };
  // Initial alignment and on resize (in case fonts or layout change)
  alignStoryline();
  window.addEventListener('resize', alignStoryline);

  /* Scroll-draw effect for storyline */
  const path = document.querySelector('.storyline path');
  if (path) {
    const length = path.getTotalLength();
    // Set up the dash pattern
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;

    const drawPath = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const start = mainEl.offsetTop; // top of storyline area
      const end = start + mainEl.offsetHeight - window.innerHeight; // when bottom reaches viewport bottom
      const progressRaw = (scrollTop - start) / (end - start);
      const progress = Math.min(Math.max(progressRaw, 0), 1); // clamp 0-1
      path.style.strokeDashoffset = length * (1 - progress);
    };

    // Initial draw
    drawPath();
    window.addEventListener('scroll', () => requestAnimationFrame(drawPath), { passive: true });
  }
}); 