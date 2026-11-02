import {landscapeImage} from './landscape-provider.js';
import {getAppearance, subscribeAppearance} from './appearance-store.js';

// Small, bounded translations follow native scrolling; no mouse tracking or running loop.
export function buildingOffsets(scroll, enabled = true, mobile = false) {
  const progress = Math.min(1, Math.max(0, Number.isFinite(scroll) ? scroll / 900 : 0));
  const distance = enabled ? progress * (mobile ? 42 : 84) : 0;
  return [distance * -.18, distance * -.42, -distance];
}

export function setupWorldBackdrop() {
  const root = document.documentElement, backdrop = document.querySelector('#world-backdrop');
  const scene = backdrop.closest('.atlas-scene');
  const image = backdrop.querySelector('.world-photo'), layers = [...backdrop.querySelectorAll('.city-buildings')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 760px)');
  let preferences = getAppearance(), scheduled = false, place;
  function paint() {
    scheduled = false;
    const enabled = preferences.motion && !reduced.matches && place === 'harbour';
    buildingOffsets(Math.max(0, 120 - scene.getBoundingClientRect().top), enabled, narrow.matches).forEach((offset, index) => {
      layers[index].style.transform = `translateY(${offset.toFixed(2)}px)`;
    });
    backdrop.dataset.moving = String(enabled);
  }
  function schedule() {
    if (scheduled || document.hidden) return;
    scheduled = true; requestAnimationFrame(paint);
  }
  function sync(value) {
    preferences = value;
    root.style.setProperty('--interface-opacity', `${value.surfaceOpacity}%`);
    schedule();
  }
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  subscribeAppearance(sync); sync(preferences);
  return {setPlace(value) {
    place = value.id; backdrop.dataset.place = place;
    image.src = landscapeImage(value); image.style.objectPosition = value.position;
    schedule();
  }};
}
