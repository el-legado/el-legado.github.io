// Header sólido al bajar
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('solid', window.scrollY > 60);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Menú móvil
const menuBtn = document.getElementById('menuBtn');
const toggleMenu = open => {
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open);
};
menuBtn.addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('.js-close').forEach(a => a.addEventListener('click', () => toggleMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });

// Aparición al hacer scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Brasas en la portada
const canvas = document.getElementById('embers');
const ctx = canvas && canvas.getContext('2d');
let particles = [];
const resize = () => {
  canvas.width = canvas.offsetWidth * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;
};
const spawn = () => ({
  x: Math.random() * canvas.width,
  y: canvas.height + Math.random() * 40,
  r: (Math.random() * 1.5 + .5) * devicePixelRatio,
  vy: (Math.random() * .6 + .3) * devicePixelRatio,
  vx: (Math.random() - .5) * .4 * devicePixelRatio,
  life: 1,
  decay: Math.random() * .004 + .002
});
const tick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (particles.length < 45) particles.push(spawn());
  particles.forEach(p => {
    p.y -= p.vy; p.x += p.vx + Math.sin(p.y / 40) * .3; p.life -= p.decay;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, ${140 + Math.floor(p.life * 80)}, 60, ${Math.max(p.life, 0)})`;
    ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(255,140,50,.8)';
    ctx.fill();
  });
  particles = particles.filter(p => p.life > 0 && p.y > -10);
  requestAnimationFrame(tick);
};
if (canvas && !matchMedia('(prefers-reduced-motion: reduce)').matches) { resize(); addEventListener('resize', resize); tick(); }

document.getElementById('year').textContent = new Date().getFullYear();
