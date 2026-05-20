export interface SpriteCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BattleBackgroundConfig {
  name: string;
  background: SpriteCrop;
  platformPlayer: SpriteCrop;
  platformEnemy: SpriteCrop;
  platformPlayerPosition: {
    left: number;
    top: number;
    scale: number;
  };
  platformEnemyPosition: {
    left: number;
    top: number;
    scale: number;
  };
}

export const battleBackgrounds: Record<string, BattleBackgroundConfig> = {
  'grass-day': {
    name: 'Grass Day',
    background: { x: 16, y: 567, width: 256, height: 144 },
    platformEnemy: { x: 1026, y: 887, width: 134, height: 34 },
    platformPlayer: { x: 896, y: 943, width: 154, height: 36 },
    platformEnemyPosition: { left: 386, top: 92, scale: 1.25 },
    platformPlayerPosition: { left: 62, top: 236, scale: 1.55 },
  },
  'grass-afternoon': {
    name: 'Grass Afternoon',
    background: { x: 284, y: 567, width: 256, height: 144 },
    platformEnemy: { x: 1314, y: 887, width: 134, height: 34 },
    platformPlayer: { x: 1185, y: 943, width: 154, height: 36 },
    platformEnemyPosition: { left: 386, top: 92, scale: 1.25 },
    platformPlayerPosition: { left: 62, top: 236, scale: 1.55 },
  },
  'grass-night': {
    name: 'Grass Night',
    background: { x: 554, y: 567, width: 256, height: 144 },
    platformEnemy: { x: 1614, y: 887, width: 134, height: 34 },
    platformPlayer: { x: 1484, y: 943, width: 154, height: 36 },
    platformEnemyPosition: { left: 386, top: 92, scale: 1.25 },
    platformPlayerPosition: { left: 62, top: 236, scale: 1.55 },
  },
  'water-day': {
    name: 'Water Day',
    background: { x: 16, y: 17, width: 256, height: 144 },
    platformEnemy: { x: 1036, y: 625, width: 122, height: 31 },
    platformPlayer: { x: 905, y: 676, width: 153, height: 34 },
    platformEnemyPosition: { left: 392, top: 94, scale: 1.25 },
    platformPlayerPosition: { left: 62, top: 236, scale: 1.55 },
  },
  'cave-night': {
    name: 'Cave Night',
    background: { x: 410, y: 1110, width: 256, height: 144 },
    platformEnemy: { x: 1535, y: 1463, width: 134, height: 34 },
    platformPlayer: { x: 1394, y: 1510, width: 158, height: 38 },
    platformEnemyPosition: { left: 386, top: 92, scale: 1.25 },
    platformPlayerPosition: { left: 62, top: 236, scale: 1.55 },
  },
  indoor: {
    name: 'Indoor',
    background: { x: 295, y: 1695, width: 256, height: 144 },
    platformEnemy: { x: 1140, y: 1462, width: 126, height: 34 },
    platformPlayer: { x: 1010, y: 1510, width: 142, height: 34 },
    platformEnemyPosition: { left: 390, top: 92, scale: 1.25 },
    platformPlayerPosition: { left: 70, top: 238, scale: 1.55 },
  },
};

export const DEFAULT_BATTLE_BACKGROUND = 'grass-day';
