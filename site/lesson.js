document.querySelectorAll('.depth-controls').forEach(group=>{
  const panes=[...group.parentElement.querySelectorAll('.depth-pane')];
  group.querySelectorAll('[data-select]').forEach(button=>button.addEventListener('click',()=>{
    group.querySelectorAll('[data-select]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    panes.forEach(pane=>{pane.hidden=pane.dataset.depth!==button.dataset.select});
  }));
});
