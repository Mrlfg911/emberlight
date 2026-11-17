// The four regions of the wood, and what each one asks of the lantern. A region is a whole run:
// it has its own palette, its own nights, and its own weather. Finishing one opens the next, and
// what you saved there is kept, so the wood remembers you.

export const REGIONS = [
  {
    id: 'clearing',
    name: 'The Clearing',
    subtitle: 'Where the lantern was lit',
    blurb: 'Soft ground, few wolves. Learn what the light costs.',
    nights: 3,
    soulsTarget: 18,
    wolves: [2, 3, 4],
    nightSeconds: [28, 30, 32],
    // A region tints the shared palette; anything it does not name stays as it is.
    palette: {
      night: '#16202f',
      haze: '#26354a',
      moss: '#2e4a3d',
      trunk: '#1a2634',
    },
    ambient: 'embers',
    hazard: null,
    accent: '#ffb257',
  },
  {
    id: 'ashfen',
    name: 'Ash Fen',
    subtitle: 'The water remembers fire',
    blurb: 'Bog lights give more, and take more. The pools are further apart.',
    nights: 4,
    soulsTarget: 26,
    wolves: [3, 4, 5, 6],
    nightSeconds: [30, 32, 34, 34],
    palette: {
      night: '#1a1a22',
      haze: '#33303a',
      moss: '#3d3a32',
      trunk: '#241f24',
      pool: '#8ce8c4',
    },
    ambient: 'ash',
    hazard: 'fog',
    accent: '#c8b6ff',
  },
  {
    id: 'hollowpines',
    name: 'Hollow Pines',
    subtitle: 'The trees lean in',
    blurb: 'The canopy eats your light. Wolves come sooner, and in pairs.',
    nights: 5,
    soulsTarget: 34,
    wolves: [4, 5, 6, 7, 8],
    nightSeconds: [32, 33, 34, 35, 36],
    palette: {
      night: '#0e1a16',
      haze: '#1d3329',
      moss: '#26473a',
      trunk: '#101f19',
    },
    ambient: 'needles',
    hazard: 'canopy',
    accent: '#8ce8a8',
  },
  {
    id: 'longdark',
    name: 'The Long Dark',
    subtitle: 'Nothing here wants you warm',
    blurb: 'Three cold pools, slow to return. What walks here is faster.',
    nights: 6,
    soulsTarget: 38,
    wolves: [5, 6, 7, 8, 9, 10],
    nightSeconds: [30, 31, 32, 33, 34, 36],
    palette: {
      night: '#0a0c16',
      haze: '#1a1c2e',
      moss: '#20263c',
      trunk: '#0d0f1a',
      pool: '#6f8cff',
    },
    ambient: 'stars',
    hazard: 'thinpool',
    poolCount: 3,
    poolRefill: 26,
    accent: '#9fb4ff',
  },
];

/** How many souls a region wants before its last night counts as a clean escape. */
export function regionById(id) {
  return REGIONS.find((region) => region.id === id) || REGIONS[0];
}

/** A region is open when it is the first, or the one before it has been cleared. */
export function isUnlocked(save, index) {
  if (index <= 0) return true;
  return Boolean(save.cleared[REGIONS[index - 1].id]);
}

export function nextRegion(save) {
  for (let index = 0; index < REGIONS.length; index += 1) {
    if (!save.cleared[REGIONS[index].id]) return REGIONS[index];
  }
  return REGIONS[REGIONS.length - 1];
}
