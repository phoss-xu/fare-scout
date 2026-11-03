// All third-party basemap access is configured here; quote data stays in our overlay.
export const BASEMAP_ORIGIN='https://tiles.openfreemap.org';
export async function loadBasemap(signal) {
  const [renderer,response]=await Promise.all([
    import('./vendor/maplibre-gl.mjs'),
    fetch(`${BASEMAP_ORIGIN}/styles/liberty`,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),credentials:'omit'})
  ]);
  if(!response.ok)throw new Error(`Basemap style HTTP ${response.status}`);
  const style=await response.json();
  if(style.version!==8 || !Array.isArray(style.layers))throw new Error('Invalid basemap style');
  // The standard geographic style supplies land cover, coastline and place-name hierarchy.
  style.layers=style.layers.filter(layer=>layer.type!=='fill-extrusion');
  // A coastal travel palette: clear water, warm land, quiet borders and gentle relief.
  const colors={background:['background-color','#f6f4e8'],water:['fill-color','#9cdedc'],park:['fill-color','#b5dbaf'],landcover_wood:['fill-color','#9dcea6'],landcover_grass:['fill-color','#c1dfa8'],landcover_sand:['fill-color','#f5e5b6'],boundary_2:['line-color','#91ad9b'],boundary_3:['line-color','#acbca6'],boundary_disputed:['line-color','#91ad9b']};
  for(const layer of style.layers){
    const color=colors[layer.id];if(color)layer.paint={...layer.paint,[color[0]]:color[1]};
    if(layer.id==='natural_earth')layer.paint['raster-opacity']=['interpolate',['linear'],['zoom'],0,.22,6,.06];
    if(layer.id==='boundary_2')layer.paint['line-opacity']=.55;
    if(layer.type==='symbol' && layer.layout?.['text-field']){
      layer.paint={...layer.paint,'text-color':layer.id.includes('water')?'#467c86':'#365c54','text-halo-color':'#fbfff5','text-halo-width':1.2};
    }
  }
  renderer.setWorkerUrl('/vendor/maplibre-gl-worker.mjs');
  return {renderer,style};
}
