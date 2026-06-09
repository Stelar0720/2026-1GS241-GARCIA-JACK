export type SkinId = 'classic' | 'gold' | 'neon' | 'medieval' | 'fire_ice' | 'royal';

export interface SkinAssets {
  blackPiece: string;
  whitePiece: string;
  blackQueen: string;
  whiteQueen: string;
  preview: string;
}

export interface SkinConfig {
  id: SkinId;
  name: string;
  price: number;
  currency: 'USD';
  unlockedByDefault?: boolean;
  assets: SkinAssets;
}

export const skins: SkinConfig[] = [
  {
    id: 'classic',
    name: 'Classic Skin',
    price: 0,
    currency: 'USD',
    unlockedByDefault: true,
    assets: {
      blackPiece: '/assets/skins/classic/classic_piece_black.png',
      whitePiece: '/assets/skins/classic/classic_piece_white.png',
      blackQueen: '/assets/skins/classic/classic_queen_black.png',
      whiteQueen: '/assets/skins/classic/classic_queen_white.png',
      preview: '/assets/skins/classic/classic_preview.png',
    },
  },
  {
    id: 'gold',
    name: 'Gold Skin',
    price: 2.99,
    currency: 'USD',
    assets: {
      blackPiece: '/assets/skins/gold/gold_piece_black.png',
      whitePiece: '/assets/skins/gold/gold_piece_white.png',
      blackQueen: '/assets/skins/gold/gold_queen_black.png',
      whiteQueen: '/assets/skins/gold/gold_queen_white.png',
      preview: '/assets/skins/gold/gold_preview.png',
    },
  },
  {
    id: 'neon',
    name: 'Neon Skin',
    price: 2.99,
    currency: 'USD',
    assets: {
      blackPiece: '/assets/skins/neon/neon_piece_black.png',
      whitePiece: '/assets/skins/neon/neon_piece_white.png',
      blackQueen: '/assets/skins/neon/neon_queen_black.png',
      whiteQueen: '/assets/skins/neon/neon_queen_white.png',
      preview: '/assets/skins/neon/neon_preview.png',
    },
  },
  {
    id: 'medieval',
    name: 'Medieval Skin',
    price: 2.99,
    currency: 'USD',
    assets: {
      blackPiece: '/assets/skins/medieval/medieval_piece_black.png',
      whitePiece: '/assets/skins/medieval/medieval_piece_white.png',
      blackQueen: '/assets/skins/medieval/medieval_queen_black.png',
      whiteQueen: '/assets/skins/medieval/medieval_queen_white.png',
      preview: '/assets/skins/medieval/medieval_preview.png',
    },
  },
  {
    id: 'fire_ice',
    name: 'Fire & Ice Skin',
    price: 2.99,
    currency: 'USD',
    assets: {
      blackPiece: '/assets/skins/fire_ice/fire_ice_piece_black.png',
      whitePiece: '/assets/skins/fire_ice/fire_ice_piece_white.png',
      blackQueen: '/assets/skins/fire_ice/fire_ice_queen_black.png',
      whiteQueen: '/assets/skins/fire_ice/fire_ice_queen_white.png',
      preview: '/assets/skins/fire_ice/fire_ice_preview.png',
    },
  },
  {
    id: 'royal',
    name: 'Royal Skin',
    price: 2.99,
    currency: 'USD',
    assets: {
      blackPiece: '/assets/skins/royal/royal_piece_black.png',
      whitePiece: '/assets/skins/royal/royal_piece_white.png',
      blackQueen: '/assets/skins/royal/royal_queen_black.png',
      whiteQueen: '/assets/skins/royal/royal_queen_white.png',
      preview: '/assets/skins/royal/royal_preview.png',
    },
  },
];

export const paidSkinIds = skins.filter((skin) => skin.price > 0).map((skin) => skin.id);

export function getSkinById(skinId: string | null | undefined) {
  return skins.find((skin) => skin.id === skinId) || skins[0];
}
