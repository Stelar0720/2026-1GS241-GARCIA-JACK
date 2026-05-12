// Sinnoh Edition - Type Chart & Constants

import type { PokemonType, TypeChart } from '../src/types.js';

export const TYPE_CHART: TypeChart = {
  normal: {
    normal: 1, fire: 1, water: 1, electric: 1, grass: 1,
    ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1,
    psychic: 1, bug: 1, rock: 0.5, ghost: 0, dragon: 1,
    dark: 1, steel: 0.5, fairy: 1
  },
  fire: {
    normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2,
    ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1,
    psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 0.5,
    dark: 1, steel: 2, fairy: 1
  },
  water: {
    normal: 1, fire: 2, water: 0.5, electric: 1, grass: 0.5,
    ice: 1, fighting: 1, poison: 1, ground: 2, flying: 1,
    psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 0.5,
    dark: 1, steel: 1, fairy: 1
  },
  electric: {
    normal: 1, fire: 1, water: 2, electric: 0.5, grass: 0.5,
    ice: 1, fighting: 1, poison: 1, ground: 0, flying: 2,
    psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 0.5,
    dark: 1, steel: 1, fairy: 1
  },
  grass: {
    normal: 1, fire: 0.5, water: 2, electric: 1, grass: 0.5,
    ice: 1, fighting: 1, poison: 0.5, ground: 2, flying: 0.5,
    psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 0.5,
    dark: 1, steel: 0.5, fairy: 1
  },
  ice: {
    normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2,
    ice: 0.5, fighting: 1, poison: 1, ground: 2, flying: 2,
    psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2,
    dark: 1, steel: 0.5, fairy: 1
  },
  fighting: {
    normal: 2, fire: 1, water: 1, electric: 1, grass: 1,
    ice: 2, fighting: 1, poison: 0.5, ground: 1, flying: 0.5,
    psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dragon: 1,
    dark: 2, steel: 2, fairy: 0.5
  },
  poison: {
    normal: 1, fire: 1, water: 1, electric: 1, grass: 2,
    ice: 1, fighting: 1, poison: 0.5, ground: 0.5, flying: 1,
    psychic: 1, bug: 1, rock: 0.5, ghost: 0.5, dragon: 1,
    dark: 1, steel: 0, fairy: 2
  },
  ground: {
    normal: 1, fire: 2, water: 1, electric: 2, grass: 0.5,
    ice: 1, fighting: 1, poison: 2, ground: 1, flying: 0,
    psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 1,
    dark: 1, steel: 2, fairy: 1
  },
  flying: {
    normal: 1, fire: 1, water: 1, electric: 0.5, grass: 2,
    ice: 1, fighting: 2, poison: 1, ground: 1, flying: 1,
    psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 1,
    dark: 1, steel: 0.5, fairy: 1
  },
  psychic: {
    normal: 1, fire: 1, water: 1, electric: 1, grass: 1,
    ice: 1, fighting: 2, poison: 2, ground: 1, flying: 1,
    psychic: 0.5, bug: 1, rock: 1, ghost: 1, dragon: 1,
    dark: 0, steel: 0.5, fairy: 1
  },
  bug: {
    normal: 1, fire: 0.5, water: 1, electric: 1, grass: 2,
    ice: 1, fighting: 0.5, poison: 0.5, ground: 1, flying: 0.5,
    psychic: 2, bug: 1, rock: 1, ghost: 0.5, dragon: 1,
    dark: 2, steel: 0.5, fairy: 0.5
  },
  rock: {
    normal: 1, fire: 2, water: 1, electric: 1, grass: 1,
    ice: 2, fighting: 0.5, poison: 1, ground: 0.5, flying: 2,
    psychic: 1, bug: 2, rock: 1, ghost: 1, dragon: 1,
    dark: 1, steel: 0.5, fairy: 1
  },
  ghost: {
    normal: 0, fire: 1, water: 1, electric: 1, grass: 1,
    ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1,
    psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1,
    dark: 0.5, steel: 1, fairy: 1
  },
  dragon: {
    normal: 1, fire: 1, water: 1, electric: 1, grass: 1,
    ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1,
    psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2,
    dark: 1, steel: 0.5, fairy: 0
  },
  dark: {
    normal: 1, fire: 1, water: 1, electric: 1, grass: 1,
    ice: 1, fighting: 0.5, poison: 1, ground: 1, flying: 1,
    psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1,
    dark: 0.5, steel: 1, fairy: 0.5
  },
  steel: {
    normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 1,
    ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1,
    psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 1,
    dark: 1, steel: 0.5, fairy: 2
  },
  fairy: {
    normal: 1, fire: 0.5, water: 1, electric: 1, grass: 1,
    ice: 1, fighting: 2, poison: 0.5, ground: 1, flying: 1,
    psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2,
    dark: 2, steel: 0.5, fairy: 1
  },
};

export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

export const TYPE_ICONS: Record<PokemonType, string> = {
  normal: '⚪',
  fire: '🔥',
  water: '💧',
  electric: '⚡',
  grass: '🌿',
  ice: '❄️',
  fighting: '👊',
  poison: '☠️',
  ground: '🌍',
  flying: '🦅',
  psychic: '🔮',
  bug: '🐛',
  rock: '🪨',
  ghost: '👻',
  dragon: '🐉',
  dark: '🌑',
  steel: '⚔️',
  fairy: '✨',
};

export const STATUS_LANGUAGE = {
  burned: 'Quemado',
  poisoned: 'Envenenado',
  asleep: 'Dormido',
  paralyzed: 'Paralizado',
  frozen: 'Congelado',
  confused: 'Confundido',
  none: 'Normal',
};