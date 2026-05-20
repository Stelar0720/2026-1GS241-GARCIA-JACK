import type { SpriteCrop } from './battleBackgrounds';

export interface UiSprite extends SpriteCrop {
  scale?: number;
}

export const battleUiSprites: Record<string, UiSprite> = {
  // TODO: Fine-tune UI crop coordinates if the source sheet changes.
  dialogBox: { x: 608, y: 342, width: 232, height: 42 },
  actionPanel: { x: 13, y: 30, width: 265, height: 210 },
  fightButton: { x: 38, y: 40, width: 214, height: 120 },
  bagButton: { x: 20, y: 182, width: 76, height: 43 },
  runButton: { x: 108, y: 192, width: 75, height: 35 },
  pokemonButton: { x: 195, y: 182, width: 75, height: 43 },
  movePanel: { x: 13, y: 248, width: 265, height: 210 },
  cancelButton: { x: 28, y: 405, width: 235, height: 43 },
  moveGround: { x: 18, y: 476, width: 122, height: 50 },
  moveWater: { x: 144, y: 476, width: 122, height: 50 },
  moveGhost: { x: 269, y: 476, width: 122, height: 50 },
  moveBug: { x: 395, y: 476, width: 122, height: 50 },
  moveFighting: { x: 18, y: 532, width: 122, height: 50 },
  movePsychic: { x: 144, y: 532, width: 122, height: 50 },
  moveGrass: { x: 269, y: 532, width: 122, height: 50 },
  moveDark: { x: 395, y: 532, width: 122, height: 50 },
  moveNormal: { x: 18, y: 589, width: 122, height: 50 },
  movePoison: { x: 144, y: 589, width: 122, height: 50 },
  moveElectric: { x: 269, y: 589, width: 122, height: 50 },
  moveUnknown: { x: 395, y: 589, width: 122, height: 50 },
  moveSteel: { x: 18, y: 645, width: 122, height: 50 },
  moveRock: { x: 144, y: 645, width: 122, height: 50 },
  moveDragon: { x: 269, y: 645, width: 122, height: 50 },
  moveFlying: { x: 18, y: 701, width: 122, height: 50 },
  moveFire: { x: 144, y: 701, width: 122, height: 50 },
  moveIce: { x: 269, y: 701, width: 122, height: 50 },
};

export const moveTypeSpriteKey: Record<string, string> = {
  ground: 'moveGround',
  water: 'moveWater',
  ghost: 'moveGhost',
  bug: 'moveBug',
  fighting: 'moveFighting',
  psychic: 'movePsychic',
  grass: 'moveGrass',
  dark: 'moveDark',
  normal: 'moveNormal',
  poison: 'movePoison',
  electric: 'moveElectric',
  steel: 'moveSteel',
  rock: 'moveRock',
  dragon: 'moveDragon',
  flying: 'moveFlying',
  fire: 'moveFire',
  ice: 'moveIce',
};
