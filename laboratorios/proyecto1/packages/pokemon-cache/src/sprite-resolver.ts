// Sinnoh Edition - Sprite Resolver
// Handles sprite URL generation and resolution

export interface SpriteConfig {
  baseUrl: string;
  shinyBaseUrl: string;
  animate: boolean;
  format: 'png' | 'gif';
}

const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  baseUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon',
  shinyBaseUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny',
  animate: false,
  format: 'png',
};

/**
 * Get front sprite URL for a Pokemon
 */
export function getFrontSprite(pokemonId: number, shiny: boolean = false): string {
  const base = shiny ? DEFAULT_SPRITE_CONFIG.shinyBaseUrl : DEFAULT_SPRITE_CONFIG.baseUrl;
  return `${base}/${pokemonId}.${DEFAULT_SPRITE_CONFIG.format}`;
}

/**
 * Get back sprite URL for a Pokemon
 */
export function getBackSprite(pokemonId: number, shiny: boolean = false): string {
  const base = shiny ? DEFAULT_SPRITE_CONFIG.shinyBaseUrl : DEFAULT_SPRITE_CONFIG.baseUrl;
  return `${base}/back/${pokemonId}.${DEFAULT_SPRITE_CONFIG.format}`;
}

/**
 * Get trainer sprite URL
 */
export function getTrainerSprite(trainerId: string | number, gender: 'male' | 'female' | 'other' = 'male'): string {
  const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer';
  
  // Map trainer names to sprite IDs
  const maleTrainers: Record<string, string> = {
    'lucas': 'Lucas',
    'barry': 'Barry',
    'ash': 'ash',
  };
  
  const femaleTrainers: Record<string, string> = {
    'luna': 'Lucas',
    'may': 'May',
    'dawn': 'dawn',
  };

  const spriteName = gender === 'female' 
    ? (femaleTrainers[trainerId.toLowerCase()] || 'Lucas')
    : (maleTrainers[trainerId.toLowerCase()] || 'Lucas');

  return `${base}/${spriteName}.png`;
}

/**
 * Get available trainer sprites by gender
 */
export function getAvailableTrainerSprites(gender: 'male' | 'female' | 'other'): { name: string; url: string }[] {
  const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer';
  
  const maleSprites = [
    { name: 'Lucas', url: `${base}/Lucas.png` },
    { name: 'Barry', url: `${base}/Barry.png` },
  ];
  
  const femaleSprites = [
    { name: 'Luna', url: `${base}/Lucas.png` },
    { name: 'May', url: `${base}/May.png` },
  ];

  if (gender === 'female') return femaleSprites;
  if (gender === 'other') return [...maleSprites, ...femaleSprites];
  return maleSprites;
}

/**
 * Get background image for battle arena
 */
export function getBattleBackground(): string {
  // Return a generated SVG or placeholder
  return 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
      <rect width="256" height="192" fill="#1a1a2e"/>
      <rect y="140" width="256" height="52" fill="#3a5a3a"/>
      <rect y="145" width="256" height="5" fill="#4a6a4a"/>
    </svg>
  `);
}

/**
 * Get type icon URL
 */
export function getTypeIcon(type: string): string {
  const typeNames: Record<string, string> = {
    normal: 'normal',
    fire: 'fire',
    water: 'water',
    electric: 'electric',
    grass: 'grass',
    ice: 'ice',
    fighting: 'fighting',
    poison: 'poison',
    ground: 'ground',
    flying: 'flying',
    psychic: 'psychic',
    bug: 'bug',
    rock: 'rock',
    ghost: 'ghost',
    dragon: 'dragon',
    dark: 'dark',
    steel: 'steel',
    fairy: 'fairy',
  };

  const typeName = typeNames[type.toLowerCase()] || 'normal';
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generationviii/${typeName}.svg`;
}

/**
 * Generate a coin sprite (for coin flip)
 */
export function generateCoinSprite(isHeads: boolean, pixelated: boolean = true): string {
  if (pixelated) {
    // Return pixel art coin SVG
    const color = isHeads ? '#ffd700' : '#c0c0c0';
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#1a1a2e"/>
        <circle cx="16" cy="16" r="12" fill="${color}" stroke="#333" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" fill="#333" font-size="14" font-weight="bold">
          ${isHeads ? 'H' : 'T'}
        </text>
      </svg>
    `)}`;
  }
  return '';
}

/**
 * Preload sprite images for better performance
 */
export function preloadSprites(pokemonIds: number[], shiny: boolean = false): Promise<void[]> {
  return pokemonIds.map(id => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = getFrontSprite(id, shiny);
    });
  });
}

/**
 * Get sprite with fallback
 */
export function getSpriteWithFallback(url: string): string {
  // Could implement actual fallback logic here
  return url;
}

export default {
  getFrontSprite,
  getBackSprite,
  getTrainerSprite,
  getAvailableTrainerSprites,
  getBattleBackground,
  getTypeIcon,
  generateCoinSprite,
  preloadSprites,
  getSpriteWithFallback,
};
