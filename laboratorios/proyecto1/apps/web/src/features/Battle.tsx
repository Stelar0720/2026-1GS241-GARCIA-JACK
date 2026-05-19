import { useEffect, useState } from 'preact/hooks';
import type { Player } from '../App';

interface BattleProps {
  player: Player;
  playerTeam: any[];
  opponentTeam: any[];
  currentTurn: string | null;
  battleUpdate: any | null;
  onBattleEnd: () => void;
  onAttack?: (action: string, data: any) => void;
  onSwitch?: (pokemonId: number) => void;
}

interface BattlePokemon {
  id: number;
  name: string;
  types: string[];
  spriteFront: string;
  spriteBack: string;
  currentHp: number;
  maxHp: number;
  moves: any[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  status: string;
  isActive: boolean;
  isFainted: boolean;
}

export function Battle({
  player,
  playerTeam,
  opponentTeam,
  currentTurn,
  battleUpdate,
  onBattleEnd,
  onAttack,
  onSwitch,
}: BattleProps) {
  const [playerPokemons, setPlayerPokemons] = useState<BattlePokemon[]>([]);
  const [opponentPokemons, setOpponentPokemons] = useState<BattlePokemon[]>([]);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [actionLog, setActionLog] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const isMyTurn = currentTurn === player.id;
  const currentPlayerPokemon = playerPokemons.find(p => p.isActive) || null;
  const currentOpponentPokemon = opponentPokemons.find(p => p.isActive) || null;

  useEffect(() => {
    setPlayerPokemons(playerTeam.map((p, i) => normalizeBattlePokemon(p, i === 0)));
    setOpponentPokemons(opponentTeam.map((p, i) => normalizeBattlePokemon(p, i === 0)));
  }, [playerTeam, opponentTeam]);

  useEffect(() => {
    if (!battleUpdate || battleUpdate.playerId === player.id) return;

    if (battleUpdate.action === 'attack') {
      applyIncomingAttack(battleUpdate.data);
    }

    if (battleUpdate.action === 'switch') {
      const pokemonId = Number(battleUpdate.data?.pokemonId);
      if (!pokemonId) return;
      setOpponentPokemons(prev => prev.map(p => ({ ...p, isActive: p.id === pokemonId })));
      const next = opponentPokemons.find(p => p.id === pokemonId);
      addLog(`El rival cambio a ${next?.name || 'otro Pokemon'}!`);
    }
  }, [battleUpdate?.receivedAt]);

  const addLog = (message: string) => {
    setBattleLog(prev => [...prev.slice(-4), message]);
    setActionLog(message);
    window.setTimeout(() => setActionLog(''), 1600);
  };

  const performAttack = (moveIndex: number) => {
    if (!currentPlayerPokemon || !currentOpponentPokemon || gameOver || !isMyTurn) return;

    const move = currentPlayerPokemon.moves[moveIndex];
    if (!move || move.pp <= 0) return;

    const result = calculateDamage(currentPlayerPokemon, currentOpponentPokemon, move);
    const targetHp = Math.max(0, currentOpponentPokemon.currentHp - result.damage);
    const isFainted = targetHp <= 0;

    addLog(`${currentPlayerPokemon.name} uso ${move.name}!`);
    if (result.isCritical) addLog('Golpe critico!');
    if (result.effectiveness === 'super-effective') addLog('Super efectivo!');
    if (result.effectiveness === 'not-effective') addLog('No es muy efectivo...');

    let updatedOpponentTeam = opponentPokemons.map(p =>
      p.id === currentOpponentPokemon.id ? { ...p, currentHp: targetHp, isFainted } : p
    );
    updatedOpponentTeam = activateNextIfNeeded(updatedOpponentTeam);
    setOpponentPokemons(updatedOpponentTeam);

    if (isFainted) addLog(`${currentOpponentPokemon.name} se debilito!`);
    if (updatedOpponentTeam.every(p => p.isFainted)) {
      setGameOver(true);
      setWinner('player');
      window.setTimeout(onBattleEnd, 2000);
    }

    setShowMoveMenu(false);
    setShowSwitchMenu(false);
    onAttack?.('attack', {
      moveIndex,
      move,
      attackerPokemonId: currentPlayerPokemon.id,
      defenderPokemonId: currentOpponentPokemon.id,
      damage: result.damage,
      targetHp,
      isFainted,
      isCritical: result.isCritical,
      effectiveness: result.effectiveness,
    });
  };

  const applyIncomingAttack = (data: any) => {
    const attacker = opponentPokemons.find(p => p.id === Number(data?.attackerPokemonId)) || currentOpponentPokemon;
    const defenderId = Number(data?.defenderPokemonId);
    if (!attacker || !defenderId) return;

    addLog(`${attacker.name} uso ${data?.move?.name || 'un movimiento'}!`);
    if (data?.isCritical) addLog('Golpe critico!');
    if (data?.effectiveness === 'super-effective') addLog('Super efectivo!');
    if (data?.effectiveness === 'not-effective') addLog('No es muy efectivo...');

    setPlayerPokemons(prev => {
      let updated = prev.map(p => {
        if (p.id !== defenderId) return p;
        const targetHp = Math.max(0, Number(data.targetHp ?? p.currentHp - Number(data.damage || 0)));
        return { ...p, currentHp: targetHp, isFainted: targetHp <= 0 || Boolean(data.isFainted) };
      });
      updated = activateNextIfNeeded(updated);

      const defeated = updated.find(p => p.id === defenderId && p.isFainted);
      if (defeated) addLog(`${defeated.name} se debilito!`);
      if (updated.every(p => p.isFainted)) {
        setGameOver(true);
        setWinner('opponent');
        window.setTimeout(onBattleEnd, 2000);
      }
      return updated;
    });
  };

  const switchPokemon = (pokemonId: number) => {
    if (!isMyTurn || gameOver) return;
    const target = playerPokemons.find(p => p.id === pokemonId);
    if (!target || target.isFainted || target.isActive) return;

    setPlayerPokemons(prev => prev.map(p => ({ ...p, isActive: p.id === pokemonId })));
    setShowSwitchMenu(false);
    setShowMoveMenu(false);
    addLog(`Cambiaste a ${target.name}!`);
    onSwitch?.(pokemonId);
  };

  const calculateDamage = (attacker: BattlePokemon, defender: BattlePokemon, move: any) => {
    const level = 50;
    const power = move.power || 40;
    const attack = attacker.stats.attack || 60;
    const defense = defender.stats.defense || 50;
    const baseDamage = ((2 * level / 5 + 2) * power * attack / defense / 50 + 2);
    const random = 0.85 + Math.random() * 0.15;
    const isCritical = Math.random() < 0.0625;
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const effectiveness = ['super-effective', 'normal', 'not-effective'][Math.floor(Math.random() * 3)];
    const typeMultiplier = effectiveness === 'super-effective' ? 2 : effectiveness === 'not-effective' ? 0.5 : 1;
    const damage = Math.max(1, Math.floor(baseDamage * stab * typeMultiplier * random * (isCritical ? 1.5 : 1)));
    return { damage, isCritical, effectiveness };
  };

  const getHpPercent = (pokemon: BattlePokemon) => Math.max(0, (pokemon.currentHp / pokemon.maxHp) * 100);

  if (playerTeam.length === 0 || opponentTeam.length === 0) {
    return (
      <div class="screen battle">
        <div class="ds-panel" style={{ textAlign: 'center', padding: '32px' }}>
          <h2 style={{ fontSize: '12px', color: '#e0c030', marginBottom: '12px' }}>ESPERANDO EQUIPOS</h2>
          <p style={{ fontSize: '9px', color: '#a8a8c8' }}>La batalla empezara cuando ambos equipos esten sincronizados.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="screen battle">
      <div class="battle-arena">
        <div class="opponent-side">
          {currentOpponentPokemon && (
            <PokemonHp pokemon={currentOpponentPokemon} getHpPercent={getHpPercent} />
          )}
          <img
            src={currentOpponentPokemon?.spriteFront}
            alt="Opponent"
            style={{ width: '80px', height: '80px', imageRendering: 'pixelated', marginTop: '8px' }}
          />
        </div>

        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: isMyTurn ? '#78c850' : '#6890f0',
          borderRadius: '4px',
          fontSize: '9px',
          color: '#1a1a2e',
          zIndex: 4,
        }}>
          {isMyTurn ? 'TU TURNO' : 'TURNO DEL OPONENTE'}
        </div>

        {actionLog && (
          <div style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            width: '70%',
            pointerEvents: 'none',
            zIndex: 3,
          }}>
            <div class="ds-textbox" style={{ fontSize: '9px', animation: 'fadeIn 0.2s', padding: '8px' }}>
              {actionLog}
            </div>
          </div>
        )}

        <div class="player-side">
          <img
            src={currentPlayerPokemon?.spriteBack}
            alt="Player"
            style={{ width: '96px', height: '96px', imageRendering: 'pixelated', marginBottom: '8px' }}
          />
          {currentPlayerPokemon && (
            <PokemonHp pokemon={currentPlayerPokemon} getHpPercent={getHpPercent} />
          )}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          background: 'rgba(26, 26, 46, 0.9)',
          padding: '8px',
          maxHeight: '80px',
          overflow: 'auto',
        }}>
          {battleLog.slice(-5).map((log, i) => (
            <p key={i} style={{ fontSize: '8px', margin: '2px 0' }}>{log}</p>
          ))}
        </div>
      </div>

      <div class="ds-panel" style={{ marginTop: '16px' }}>
        {!gameOver && isMyTurn && (
          <>
            {!showMoveMenu && !showSwitchMenu && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button class="ds-button gold" onClick={() => setShowMoveMenu(true)} style={{ flex: 1 }}>LUCHAR</button>
                <button class="ds-button" onClick={() => setShowSwitchMenu(true)} style={{ flex: 1 }}>CAMBIAR</button>
              </div>
            )}

            {showMoveMenu && (
              <MoveMenu
                pokemon={currentPlayerPokemon}
                onBack={() => setShowMoveMenu(false)}
                onAttack={performAttack}
              />
            )}

            {showSwitchMenu && (
              <SwitchMenu
                pokemons={playerPokemons}
                onBack={() => setShowSwitchMenu(false)}
                onSwitch={switchPokemon}
              />
            )}
          </>
        )}

        {!gameOver && !isMyTurn && (
          <div style={{ textAlign: 'center', padding: '12px', color: '#a8a8c8', fontSize: '9px' }}>
            Esperando decision del oponente...
          </div>
        )}

        {gameOver && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '16px', color: winner === 'player' ? '#e0c030' : '#c03030', marginBottom: '16px' }}>
              {winner === 'player' ? 'VICTORIA' : 'DERROTA'}
            </p>
            <button class="ds-button gold" onClick={onBattleEnd}>CONTINUAR</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PokemonHp({ pokemon, getHpPercent }: { pokemon: BattlePokemon; getHpPercent: (pokemon: BattlePokemon) => number }) {
  const hpPercent = getHpPercent(pokemon);
  return (
    <div class="hp-container">
      <div class="hp-text">
        <span style={{ fontSize: '9px' }}>{pokemon.name}</span>
        {pokemon.status !== 'none' && (
          <span style={{ fontSize: '7px', marginLeft: '8px', padding: '2px 4px', borderRadius: '2px', background: '#f08030' }}>
            {pokemon.status.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ fontSize: '8px', color: '#a8a8c8' }}>{pokemon.currentHp}/{pokemon.maxHp}</div>
      <div class="hp-bar-outer">
        <div
          class={`hp-bar-inner ${hpPercent < 20 ? 'critical' : hpPercent < 50 ? 'warning' : ''}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
    </div>
  );
}

function MoveMenu({ pokemon, onBack, onAttack }: { pokemon: BattlePokemon | null; onBack: () => void; onAttack: (index: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '10px' }}>MOVIMIENTOS</h3>
        <button class="ds-button" onClick={onBack} style={{ fontSize: '8px', padding: '6px 12px' }}>VOLVER</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {pokemon?.moves.map((move, i) => (
          <button
            key={i}
            class="ds-button"
            onClick={() => onAttack(i)}
            disabled={move.pp <= 0}
            style={{
              textAlign: 'left',
              padding: '8px',
              borderLeft: `4px solid ${getTypeColor(move.type)}`,
              background: move.pp <= 0 ? '#1a1a2e' : undefined,
            }}
          >
            <div style={{ fontSize: '9px' }}>{move.name}</div>
            <div style={{ fontSize: '7px', color: '#a8a8c8', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ background: getTypeColor(move.type), padding: '1px 4px', borderRadius: '2px', color: '#fff', textShadow: '1px 1px 1px #000' }}>
                {move.type.toUpperCase()}
              </span>
              <span>PP: {move.pp}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchMenu({ pokemons, onBack, onSwitch }: { pokemons: BattlePokemon[]; onBack: () => void; onSwitch: (id: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '10px' }}>CAMBIAR POKEMON</h3>
        <button class="ds-button" onClick={onBack} style={{ fontSize: '8px', padding: '6px 12px' }}>VOLVER</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {pokemons.map((pokemon) => (
          <button
            key={pokemon.id}
            class="ds-button"
            onClick={() => onSwitch(pokemon.id)}
            disabled={pokemon.isActive || pokemon.isFainted}
            style={{ padding: '8px', opacity: pokemon.isFainted ? 0.45 : 1, borderColor: pokemon.isActive ? '#78c850' : undefined }}
          >
            <img src={pokemon.spriteFront} alt={pokemon.name} style={{ width: '42px', height: '42px', imageRendering: 'pixelated' }} />
            <div style={{ fontSize: '8px' }}>{pokemon.name}</div>
            <div style={{ fontSize: '7px', color: '#a8a8c8' }}>{pokemon.currentHp}/{pokemon.maxHp} HP</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function normalizeBattlePokemon(pokemon: any, isActive: boolean): BattlePokemon {
  const stats = pokemon.stats || {};
  const maxHp = Number(pokemon.maxHp || pokemon.currentHp || stats.hp || 100);
  const id = Number(pokemon.id);

  return {
    id,
    name: pokemon.name || `Pokemon ${id}`,
    types: pokemon.types?.length ? pokemon.types : ['normal'],
    spriteFront: pokemon.spriteFront || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
    spriteBack: pokemon.spriteBack || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`,
    currentHp: Number(pokemon.currentHp || maxHp),
    maxHp,
    moves: normalizeMoves(pokemon.moves, pokemon.types),
    stats: {
      hp: Number(stats.hp || maxHp),
      attack: Number(stats.attack || 60),
      defense: Number(stats.defense || 50),
      speed: Number(stats.speed || 50),
    },
    status: pokemon.status || 'none',
    isActive,
    isFainted: Boolean(pokemon.isFainted) || Number(pokemon.currentHp || maxHp) <= 0,
  };
}

function activateNextIfNeeded(team: BattlePokemon[]) {
  const active = team.find(p => p.isActive);
  if (active && !active.isFainted) return team;
  const next = team.find(p => !p.isFainted);
  if (!next) return team;
  return team.map(p => ({ ...p, isActive: p.id === next.id }));
}

function normalizeMoves(moves: any[] | undefined, types: string[] = []) {
  const usableMoves = moves?.filter(Boolean).slice(0, 4) || [];
  if (usableMoves.length > 0) {
    return usableMoves.map((move, index) => ({
      id: move.id || index + 1,
      name: move.name || 'Tackle',
      type: move.type || types[0] || 'normal',
      power: move.power ?? 40,
      accuracy: move.accuracy ?? 100,
      pp: move.pp ?? move.maxPp ?? 20,
      maxPp: move.maxPp ?? move.pp ?? 20,
    }));
  }

  return [
    { id: 1, name: 'Tackle', type: 'normal', power: 40, accuracy: 100, pp: 35, maxPp: 35 },
    { id: 2, name: 'Quick Attack', type: 'normal', power: 40, accuracy: 100, pp: 30, maxPp: 30 },
    { id: 3, name: 'Swift', type: 'normal', power: 60, accuracy: 100, pp: 20, maxPp: 20 },
    { id: 4, name: 'Type Strike', type: types[0] || 'normal', power: 50, accuracy: 100, pp: 25, maxPp: 25 },
  ];
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC',
  };
  return colors[type] || colors.normal;
}
