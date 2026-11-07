/** Release decisions, not computed results or fixture data. */
export const PANEL_IDS = ['P1', 'P2', 'P3', 'P4'] as const;
export const LOAD_NODE_IDS = ['B1', 'B2', 'B3'] as const;
export const PRESET_VERSION = 'forma-four-panel-v1';
export const FIXED_LOAD_FY_N = -10 as const;
export const PRESET_DEFAULTS = Object.freeze({
  bayWidthMm: 60,
  heightMm: 40,
  bayCount: 4,
  elasticModulusNPerMm2: 10_000,
  areaMm2: 10,
});
