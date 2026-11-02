// Apply the saved theme before styles paint, including native date controls.
(() => {
  const ids = ['paper','moss','sea','rose','mocha','night'];
  try {
    const saved = JSON.parse(localStorage.getItem('fare-scout:appearance'));
    document.documentElement.dataset.theme = ids.includes(saved?.theme) ? saved.theme : 'paper';
  } catch (error) {
    document.documentElement.dataset.theme = 'paper';
    console.info('Initial theme preference unavailable', error.name);
  }
})();
