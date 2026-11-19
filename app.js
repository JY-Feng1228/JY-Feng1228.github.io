'use strict';

// 光标跟随的背景光晕（布局参考 Brittany Chiang v5）
const spotlight = document.querySelector('.spotlight');
const fine = window.matchMedia('(pointer: fine)').matches;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (spotlight && fine && !calm) {
  window.addEventListener('pointermove', (e) => {
    spotlight.style.setProperty('--x', e.clientX + 'px');
    spotlight.style.setProperty('--y', e.clientY + 'px');
  }, { passive: true });
}

// 左侧导航高亮当前区块
const navLinks = Array.from(document.querySelectorAll('.side-nav a'));
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => io.observe(s));
}

// 证据弹窗
const dialog = document.getElementById('evidence-dialog');
const dialogContent = document.getElementById('evidence-content');
const dialogTitle = document.getElementById('evidence-title');
const closeButton = dialog.querySelector('.close-dialog');
let previousFocus;
document.querySelectorAll('[data-evidence]').forEach((button) => {
  button.addEventListener('click', () => {
    const template = document.getElementById(button.dataset.evidence);
    if (!template) return;
    previousFocus = button;
    dialogTitle.textContent = template.dataset.title;
    dialogContent.replaceChildren(template.content.cloneNode(true));
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('dialog-open');
    closeButton.focus();
  });
});
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  if (previousFocus) previousFocus.focus();
});
