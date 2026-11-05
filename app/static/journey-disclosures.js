/** Dismiss top-level journey editors without clearing the user's selections. */
export function setupJourneyDisclosures(form,{document:doc=globalThis.document}={}) {
  const editors=[...form.querySelectorAll('.journey-choices>details,.journey-extras')];
  function close(editor,focus=false) {
    editor.open=false;
    const summary=editor.querySelector('summary');
    summary.setAttribute('aria-expanded','false');
    if(focus)summary.focus({preventScroll:true});
  }
  // Capture the original event path before a selected city re-renders its button.
  doc.addEventListener('pointerdown',event=>{
    if(doc.querySelector('dialog[open]'))return;
    const path=event.composedPath();
    for(const editor of editors)if(editor.open && !path.includes(editor))close(editor);
  },true);
  doc.addEventListener('keydown',event=>{
    if(event.key!=='Escape' || event.defaultPrevented || doc.querySelector('dialog[open]'))return;
    const editor=editors.find(editor=>editor.open && event.composedPath().includes(editor)) || editors.find(editor=>editor.open);
    if(editor){event.preventDefault();close(editor,true);}
  });
  for(const editor of editors) {
    editor.addEventListener('click',event=>{
      if(event.target.closest('[data-journey-done]'))close(editor,true);
    });
    editor.addEventListener('toggle',()=>{
      editor.querySelector('summary').setAttribute('aria-expanded',String(editor.open));
      if(editor.open)for(const other of editors)if(other!==editor && other.open)close(other);
    });
  }
}
