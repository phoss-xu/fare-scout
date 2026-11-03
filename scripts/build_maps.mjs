import {copyFile,mkdir} from 'node:fs/promises';
// Keep the renderer and worker on our own origin; no CDN scripts or blob workers.
await mkdir('app/static/vendor',{recursive:true});
for(const name of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs','maplibre-gl.css']) {
  await copyFile(`node_modules/maplibre-gl/dist/${name}`,`app/static/vendor/${name}`);
}
await copyFile('node_modules/maplibre-gl/LICENSE.txt','app/static/vendor/MapLibre-LICENSE.txt');
