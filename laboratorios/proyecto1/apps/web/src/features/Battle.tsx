// Sinnoh Edition - Battle Screen with WebSocket
import { useState, useEffect } from 'preact/hooks';
import type { Player } from '../App';

interface BattleProps {
  player: Player;
  playerTeam: any[];
  opponentTeam: any[];
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

export function Battle({ player: _player, playerTeam, opponentTeam, onBattleEnd, onAttack, onSwitch: _onSwitch }: BattleProps) {
  const [playerPokemons, setPlayerPokemons] = useState<BattlePokemon[]>([]);
  const [opponentPokemons, setOpponentPokemons] = useState<BattlePokemon[]>([]);
  const [currentPlayerPokemon, setCurrentPlayerPokemon] = useState<BattlePokemon | null>(null);
  const [currentOpponentPokemon, setCurrentOpponentPokemon] = useState<BattlePokemon | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<string>('');
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(true);

  // Initialize battle
  useEffect(() => {
    const team = playerTeam.length > 0 ? playerTeam : createMockTeam(1);
    const oppTeam = opponentTeam.length > 0 ? opponentTeam : createMockTeam(2);
    
    setPlayerPokemons(team.map((p: any, i: number) => ({ ...p, isActive: i === 0 })));
    setOpponentPokemons(oppTeam.map((p: any, i: number) => ({ ...p, isActive: i === 0 })));
  }, [playerTeam, opponentTeam]);

  useEffect(() => {
    setCurrentPlayerPokemon(playerPokemons.find(p => p.isActive) || null);
    setCurrentOpponentPokemon(opponentPokemons.find(p => p.isActive) || null);
  }, [playerPokemons, opponentPokemons]);

  const createMockTeam = (player: number) => {
    const pokemons = [
      { id: 400 + player, name: player === 1 ? 'Piplup' : 'Turtwig', types: ['water'], stats: { hp: 100, attack: 60, defense: 50, speed: 50 } },
      { id: 500 + player, name: player === 1 ? 'Prinplup' : 'Grotle', types: ['water'], stats: { hp: 120, attack: 80, defense: 70, speed: 60 } },
      { id: 600 + player, name: player === 1 ? 'Empoleon' : 'Torterra', types: ['water', 'steel'], stats: { hp: 150, attack: 100, defense: 90, speed: 70 } },
    ];
    
    return pokemons.map(p => ({
      ...p,
      spriteFront: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`,
      spriteBack: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${p.id}.png`,
      currentHp: p.stats.hp,
      maxHp: p.stats.hp,
      moves: [
        { id: 1, name: 'Tackle', type: 'normal', power: 40, accuracy: 100, pp: 35 },
        { id: 2, name: 'Growl', type: 'normal', power: 0, accuracy: 100, pp: 40 },
      ],
      status: 'none',
      isFainted: false,
    }));
  };

  const addLog = (message: string) => {
    setBattleLog(prev => [...prev.slice(-4), message]);
    setActionLog(message);
    setTimeout(() => setActionLog(''), 2000);
  };

  const performAttack = (moveIndex: number) => {
    if (!currentPlayerPokemon || !currentOpponentPokemon || gameOver || !isMyTurn) return;

    const move = currentPlayerPokemon.moves[moveIndex];
    if (!move || move.pp <= 0) return;

    const damage = calculateDamage(currentPlayerPokemon, currentOpponentPokemon, move);
    const newHp = Math.max(0, currentOpponentPokemon.currentHp - damage.damage);

    addLog(`${currentPlayerPokemon.name} usó ${move.name}!`);

    if (damage.isCritical) addLog('¡Golpe crítico!');
    if (damage.effectiveness === 'super-effective') addLog('¡Super efectivo!');

    // Update opponent pokemon
    const updatedOpponent = {
      ...currentOpponentPokemon,
      currentHp: newHp,
      isFainted: newHp <= 0,
    };

    const updatedOpponentTeam = opponentPokemons.map(p => 
      p.isActive ? updatedOpponent : p
    );

    if (newHp <= 0) addLog(`${currentOpponentPokemon.name} se debilitó!`);

    setOpponentPokemons(updatedOpponentTeam);
    setShowMoveMenu(false);
    setIsMyTurn(false);

    // Send action to opponent via WebSocket
    onAttack?.('attack', { moveIndex, damage: damage.damage });

    // Check win
    if (updatedOpponentTeam.every(p => p.isFainted)) {
      setGameOver(true);
      setWinner('player');
      addLog('¡Victoria!');
      setTimeout(onBattleEnd, 2000);
      return;
    }

    // Opponent turn after delay
    setTimeout(() => opponentAttack(updatedOpponentTeam), 1500);
  };

  const opponentAttack = (currentTeam: BattlePokemon[]) => {
    const opponent = currentTeam.find(p => p.isActive);
    if (!opponent) return;

    const availableMoves = opponent.moves.filter((m: any) => m.pp > 0);
    const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    if (!move) return;

    const playerActive = playerPokemons.find(p => p.isActive);
    if (!playerActive) return;

    const damage = calculateDamage(opponent, playerActive, move);
    const newHp = Math.max(0, playerActive.currentHp - damage.damage);

    addLog(`${opponent.name} usó ${move.name}!`);
    if (damage.effectiveness === 'super-effective') addLog('¡Super efectivo!');

    let updatedPlayerTeam = playerPokemons.map(p => 
      p.isActive ? { ...p, currentHp: newHp, isFainted: newHp <= 0 } : p
    );

    if (newHp <= 0) {
      addLog(`${playerActive.name} se debilitó!`);
      
      const nextAvailable = updatedPlayerTeam.find(p => !p.isFainted);
      if (nextAvailable) {
        updatedPlayerTeam = updatedPlayerTeam.map(p => ({
          ...p,
          isActive: p.id === nextAvailable.id,
        }));
        setPlayerPokemons(updatedPlayerTeam);
        addLog(`¡Ve! ${nextAvailable.name}!`);
        
        if (updatedPlayerTeam.every(p => p.isFainted)) {
          setGameOver(true);
          setWinner('opponent');
          addLog('Derrota...');
          setTimeout(onBattleEnd, 2000);
          return;
        }
      }
    } else {
      setPlayerPokemons(updatedPlayerTeam);
    }

    if (updatedPlayerTeam.every(p => p.isFainted)) {
      setGameOver(true);
      setWinner('opponent');
      addLog('Derrota...');
      setTimeout(onBattleEnd, 2000);
    }

    setIsMyTurn(true);
  };

  const calculateDamage = (attacker: BattlePokemon, defender: BattlePokemon, move: any) => {
    const level = 50;
    const power = move.power || 40;
    const attack = attacker.stats.attack || 60;
    const defense = defender.stats.defense || 50;
    
    const baseDamage = ((2 * level / 5 + 2) * power * attack / defense / 50 + 2);
    const random = 0.85 + Math.random() * 0.15;
    const isCritical = Math.random() < 0.0625;
    const critMultiplier = isCritical ? 1.5 : 1;
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const effectiveness = ['super-effective', 'normal', 'not-effective'][Math.floor(Math.random() * 3)];
    const typeMultiplier = effectiveness === 'super-effective' ? 2 : effectiveness === 'not-effective' ? 0.5 : 1;
    
    const damage = Math.floor(baseDamage * stab * typeMultiplier * random * critMultiplier);
    
    return { damage, isCritical, effectiveness };
  };

  const getHpPercent = (pokemon: BattlePokemon) => {
    return Math.max(0, (pokemon.currentHp / pokemon.maxHp) * 100);
  };

  return (
    <div class="screen battle">
      <div class="battle-arena">
        {/* Opponent Side */}
        <div class="opponent-side">
          {currentOpponentPokemon && (
            <div class="hp-container">
              <div class="hp-text">
                <span style={{ fontSize: '9px' }}>{currentOpponentPokemon.name}</span>
                {currentOpponentPokemon.status !== 'none' && (
                  <span style={{ fontSize: '7px', marginLeft: '8px', padding: '2px 4px', borderRadius: '2px', background: '#f08030' }}>
                    {currentOpponentPokemon.status.toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '8px', color: '#a8a8c8' }}>
                {currentOpponentPokemon.currentHp}/{currentOpponentPokemon.maxHp}
              </div>
              <div class="hp-bar-outer">
                <div 
                  class={`hp-bar-inner ${getHpPercent(currentOpponentPokemon) < 20 ? 'critical' : getHpPercent(currentOpponentPokemon) < 50 ? 'warning' : ''}`}
                  style={{ width: `${getHpPercent(currentOpponentPokemon)}%` }}
                />
              </div>
            </div>
          )}
          <img 
            src={currentOpponentPokemon?.spriteFront}
            alt="Opponent"
            style={{ width: '80px', height: '80px', imageRendering: 'pixelated', marginTop: '8px' }}
          />
        </div>

        {/* Turn Indicator */}
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: isMyTurn ? '#78c850' : '#6890f0',
          borderRadius: '4px',
          fontSize: '9px',
          color: '#1a1a2e'
        }}>
          {isMyTurn ? 'TU TURNO' : 'TURNO DEL OPONENTE'}
        </div>

        {/* Action Log */}
        <div style={{ 
          position: 'absolute', 
top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '80%'
        }}>
          {actionLog && (
            <div class="ds-textbox" style={{ fontSize: '9px', animation: 'fadeIn 0.2s' }}>
              {actionLog}
            </div>
          )}
        </div>

        {/* Player Side */}
        <div class="player-side">
          <img 
            src={currentPlayerPokemon?.spriteBack}
            alt="Player"
            style={{ width: '96px', height: '96px', imageRendering: 'pixelated', marginBottom: '8px' }}
          />
          {currentPlayerPokemon && (
            <div class="hp-container">
              <div class="hp-text">
                <span style={{ fontSize: '9px' }}>{currentPlayerPokemon.name}</span>
                {currentPlayerPokemon.status !== 'none' && (
                  <span style={{ fontSize: '7px', marginLeft: '8px', padding: '2px 4px', borderRadius: '2px', background: '#f08030' }}>
                    {currentPlayerPokemon.status.toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '8px', color: '#a8a8c8' }}>
                {currentPlayerPokemon.currentHp}/{currentPlayerPokemon.maxHp}
              </div>
              <div class="hp-bar-outer">
                <div 
                  class={`hp-bar-inner ${getHpPercent(currentPlayerPokemon) < 20 ? 'critical' : getHpPercent(currentPlayerPokemon) < 50 ? 'warning' : ''}`}
                  style={{ width: `${getHpPercent(currentPlayerPokemon)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Battle Log */}
        <div style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          background: 'rgba(26, 26, 46, 0.9)',
          padding: '8px',
          maxHeight: '80px',
          overflow: 'auto'
        }}>
          {battleLog.slice(-5).map((log, i) => (
            <p key={i} style={{ fontSize: '8px', margin: '2px 0' }}>{log}</p>
          ))}
        </div>
      </div>

      {/* Move Menu */}
      <div class="ds-panel" style={{ marginTop: '16px' }}>
        {!gameOver && isMyTurn && (
          <>
            {!showMoveMenu ? (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  class="ds-button gold"
                  onClick={() => setShowMoveMenu(true)}
                  style={{ flex: 1 }}
                >
                  LUCHAR
                </button>
                <button 
                  class="ds-button"
                  onClick={() => {/* Switch menu - future */}}
                  style={{ flex: 1 }}
                >
                  CAMBIAR
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '10px' }}>MOVIMIENTOS</h3>
                  <button 
                    class="ds-button"
                    onClick={() => setShowMoveMenu(false)}
                    style={{ fontSize: '8px', padding: '6px 12px' }}
                  >
                    VOLVER
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {currentPlayerPokemon?.moves.map((move, i) => (
                    <button
                      key={i}
                      class="ds-button"
                      onClick={() => performAttack(i)}
                      disabled={move.pp <= 0}
                      style={{ textAlign: 'left', padding: '8px' }}
                    >
                      <div style={{ fontSize: '9px' }}>{move.name}</div>
                      <div style={{ fontSize: '7px', color: '#a8a8c8', marginTop: '4px' }}>
                        {move.type.toUpperCase()} | PP: {move.pp}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {(!isMyTurn || !showMoveMenu) && !gameOver && (
          <div style={{ textAlign: 'center', padding: '12px', color: '#a8a8c8', fontSize: '9px' }}>
            Esperando decisión...
          </div>
        )}

        {gameOver && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ 
              fontSize: '16px', 
              color: winner === 'player' ? '#e0c030' : '#c03030',
              marginBottom: '16px'
            }}>
              {winner === 'player' ? '¡VICTORIA!' : 'DERROTA'}
            </p>
            <button class="ds-button gold" onClick={onBattleEnd}>
              CONTINUAR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
