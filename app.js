'use strict';
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectTab(tab, focus = false) {
  tabs.forEach(item => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
  });
});
const dialog = document.getElementById('evidence-dialog');
const dialogContent = document.getElementById('evidence-content');
const dialogTitle = document.getElementById('evidence-title');
const closeButton = dialog.querySelector('.close-dialog');
let previousFocus;
document.querySelectorAll('[data-evidence]').forEach(button => {
  button.addEventListener('click', () => {
    const template = document.getElementById(button.dataset.evidence);
    if (!template) return;
    previousFocus = button;
    dialogTitle.textContent = template.dataset.title;
    dialogContent.replaceChildren(template.content.cloneNode(true));
    dialog.showModal(); dialog.scrollTop = 0;
    document.body.classList.add('dialog-open'); closeButton.focus();
  });
});
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open'); previousFocus?.focus();
});
