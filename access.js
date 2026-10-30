/* Shared product rules. This UI policy is not a substitute for server authorization. */
(function (root) {
  const freeThemes = Object.freeze(['tomato', 'sundial', 'zen']);
  const themeNames = Object.freeze({
    tomato: 'Tomato', sundial: 'Desert Oasis', zen: 'Zen Garden',
    astronomical: 'Astronomical Clock', rolex: 'Chronometer', hourglass: 'Hourglass',
    retro: '8-bit Retro', rainy: 'Rainy Day', night: 'Night Sky',
    forest: 'Forest Retreat', winter: 'Northern Lights'
  });
  const policy = Object.freeze({
    freeThemes, themeNames,
    canUseTheme: (theme, plus = false) => Object.hasOwn(themeNames, theme) && (plus || freeThemes.includes(theme)),
    canUseFeature: (feature, plus = false) => ['timer', 'today'].includes(feature) || (plus && ['goals', 'history'].includes(feature)),
    startupTheme: (savedTheme, defaultTheme, plus = false) => {
      if (plus && Object.hasOwn(themeNames, defaultTheme)) return defaultTheme;
      return Object.hasOwn(themeNames, savedTheme) && (plus || freeThemes.includes(savedTheme)) ? savedTheme : 'tomato';
    },
    // Simulated paid access is confined to explicit local development URLs.
    isLocalPreview: (location) => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
      && new URLSearchParams(location.search).get('review') === 'plus'
  });
  root.TomodoAccess = policy;
  if (typeof module !== 'undefined') module.exports = policy;
})(globalThis);
