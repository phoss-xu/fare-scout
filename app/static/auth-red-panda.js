// Eight felt-patch poses derived from the user-approved character, in a 4 × 2 atlas.
// Row 1: map, backpack, privacy, suitcase. Row 2: steps A/B, boarding pass, retry.
export const redPandaScene = `
<div class="auth-journey" data-state="idle">
  <div class="journey-stage" aria-hidden="true">
    <div class="journey-ground"></div>
    <div class="journey-trail"></div>
    <svg class="journey-sign" viewBox="0 0 38 52" focusable="false"><path d="M16 51V5M1 5h27l8 8-8 8H1zM9 13h17m-4-3 4 3-4 3"/></svg>
    <div class="journey-traveler">
      <div class="panda-sway"><div class="panda-sprite"></div></div>
      <div class="journey-shadow"></div>
    </div>
  </div>
  <p class="journey-caption" aria-live="polite" aria-atomic="true"></p>
</div>`;
