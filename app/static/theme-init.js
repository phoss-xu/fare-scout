// Apply the saved theme before styles paint, including native date controls.
(() => {
  try {document.documentElement.lang=JSON.parse(localStorage.getItem('fare-scout:preferences'))?.language==='en'?'en':'zh-CN';}
  catch {document.documentElement.lang='zh-CN';}
  const ids = ['paper','moss','sea','rose','mocha','night'];
  try {
    const saved = JSON.parse(localStorage.getItem('fare-scout:appearance'));
    document.documentElement.dataset.font = ['momo','serif','source-hans'].includes(saved?.font) ? saved.font : 'serif';
    document.documentElement.dataset.theme = ids.includes(saved?.theme) ? saved.theme : 'paper';
  } catch (error) {
    document.documentElement.dataset.theme = 'paper';
    document.documentElement.dataset.font = 'serif';
    console.info('Initial theme preference unavailable', error.name);
  }
})();
