import { useEffect, useState } from 'preact/hooks';
import type { Player } from '../App';
import { BattleField } from './battle/BattleField';
import { MoveSelector } from './battle/MoveSelector';

interface BattleProps {
  player: Player;
  opponent: Player | null;
  playerTeam: any[];
  opponentTeam: any[];
  currentTurn: string | null;
  battleUpdate: any | null;
  coinFlip: any | null;
  onCoinChoice?: (side: 'red' | 'charizard') => void;
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

const coinModules = import.meta.glob('../../../../sprites/coin/*.{png,jpg,jpeg,PNG,JPG,JPEG}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const COIN_IMAGES = Object.entries(coinModules).reduce<Record<string, string>>((acc, [path, url]) => {
  const name = path.toLowerCase();
  if (name.includes('charizard')) acc.charizard = url;
  if (name.includes('redcoin.png')) acc.red = url;
  if (name.includes('pokeball defeated')) acc.pokeballDefeated = url;
  if (name.includes('pokeball.png')) acc.pokeball = url;
  return acc;
}, {});

export function Battle({
  player,
  opponent,
  playerTeam,
  opponentTeam,
  currentTurn,
  battleUpdate,
  coinFlip,
  onCoinChoice,
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
  const [systemMessage, setSystemMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showCoinFlip, setShowCoinFlip] = useState(true);
  const [coinAnimating, setCoinAnimating] = useState(false);
  const [coinFrame, setCoinFrame] = useState<'red' | 'charizard'>('red');

  const isMyTurn = currentTurn === player.id;
  const currentPlayerPokemon = playerPokemons.find(p => p.isActive) || null;
  const currentOpponentPokemon = opponentPokemons.find(p => p.isActive) || null;

  useEffect(() => {
    setPlayerPokemons(playerTeam.map((p, i) => normalizeBattlePokemon(p, i === 0)));
    setOpponentPokemons(opponentTeam.map((p, i) => normalizeBattlePokemon(p, i === 0)));
    setShowCoinFlip(true);
  }, [playerTeam, opponentTeam]);

  useEffect(() => {
    if (!coinFlip || coinFlip.status !== 'result') return;
    setCoinAnimating(true);
    const frameTimer = window.setInterval(() => {
      setCoinFrame(frame => frame === 'red' ? 'charizard' : 'red');
    }, 120);
    const animationTimer = window.setTimeout(() => setCoinAnimating(false), 1200);
    const timer = window.setTimeout(() => setShowCoinFlip(false), 3600);
    return () => {
      window.clearInterval(frameTimer);
      window.clearTimeout(animationTimer);
      window.clearTimeout(timer);
    };
  }, [coinFlip?.status, coinFlip?.side]);

  useEffect(() => {
    if (!coinFlip || coinFlip.status !== 'choosing') return;
    setShowCoinFlip(true);
    setCoinAnimating(false);
  }, [coinFlip?.status]);

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

  const showTemporaryMessage = (message: string) => {
    setSystemMessage(message);
    window.setTimeout(() => setSystemMessage(''), 2600);
  };

  const chooseCoinSide = (side: 'red' | 'charizard') => {
    setCoinAnimating(true);
    const frameTimer = window.setInterval(() => {
      setCoinFrame(frame => frame === 'red' ? 'charizard' : 'red');
    }, 120);
    window.setTimeout(() => window.clearInterval(frameTimer), 1400);
    onCoinChoice?.(side);
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

  const overlay = coinFlip && showCoinFlip ? (
    <CoinFlipOverlay
      coinFlip={coinFlip}
      player={player}
      coinAnimating={coinAnimating}
      coinFrame={coinFrame}
      onChoose={chooseCoinSide}
    />
  ) : null;

  const message = getBattleMessage({
    player,
    opponent,
    coinFlip,
    actionLog,
    systemMessage,
    battleLog,
    gameOver,
    winner,
  });

  const menuContent = showMoveMenu ? (
    <MoveSelector moves={currentPlayerPokemon?.moves || []} onCancel={() => setShowMoveMenu(false)} onMove={performAttack} />
  ) : showSwitchMenu ? (
    <SwitchMenu pokemons={playerPokemons} onBack={() => setShowSwitchMenu(false)} onSwitch={switchPokemon} />
  ) : null;

  return (
    <div class="screen battle">
      <BattleField
        playerPokemon={currentPlayerPokemon}
        enemyPokemon={currentOpponentPokemon}
        playerTeam={playerPokemons}
        enemyTeam={opponentPokemons}
        pokeballUrl={COIN_IMAGES.pokeball}
        pokeballDefeatedUrl={COIN_IMAGES.pokeballDefeated}
        message={message}
        isMyTurn={isMyTurn && !showCoinFlip && !gameOver}
        backgroundId="grass-day"
        overlay={overlay}
        menuContent={menuContent}
        onAttack={() => setShowMoveMenu(true)}
        onSwitch={() => setShowSwitchMenu(true)}
        onBag={() => showTemporaryMessage('Un verdadero campeón no necesita objetos.')}
        onRun={() => showTemporaryMessage('¡COBARDE! No puedes huir de un combate de campeonato.')}
      />
    </div>
  );
}

function CoinFlipOverlay({
  coinFlip,
  player,
  coinAnimating,
  coinFrame,
  onChoose,
}: {
  coinFlip: any;
  player: Player;
  coinAnimating: boolean;
  coinFrame: 'red' | 'charizard';
  onChoose: (side: 'red' | 'charizard') => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      background: 'rgba(10, 10, 30, 0.86)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '16px',
    }}>
      <div style={{ width: '130px', height: '130px', marginBottom: '14px', perspective: '700px' }}>
        <img
          src={COIN_IMAGES[coinAnimating ? coinFrame : (coinFlip.side || 'red')]}
          alt={coinAnimating ? coinFrame : (coinFlip.side || 'coin')}
          style={{
            width: '130px',
            height: '130px',
            objectFit: 'contain',
            animation: coinAnimating ? 'coinFlipSpin 0.32s linear infinite' : undefined,
            filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.45))',
          }}
        />
      </div>

      {coinFlip.status === 'choosing' ? (
        <div class="ds-textbox" style={{ fontSize: '10px', maxWidth: '300px' }}>
          <p style={{ marginBottom: '10px', color: '#e0c030' }}>
            {coinFlip.chooserPlayerId === player.id ? 'Elige cara o cruz' : 'El rival esta eligiendo cara o cruz...'}
          </p>
          {coinFlip.chooserPlayerId === player.id && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button class="ds-button gold" onClick={() => onChoose('red')}>CARA</button>
              <button class="ds-button" onClick={() => onChoose('charizard')}>CRUZ</button>
            </div>
          )}
          <p style={{ marginTop: '8px', fontSize: '8px', color: '#a8a8c8' }}>Cara = Red · Cruz = Charizard</p>
        </div>
      ) : (
        <div class="ds-textbox" style={{ fontSize: '10px', maxWidth: '300px' }}>
          <p style={{ marginBottom: '6px', color: '#e0c030' }}>
            {coinFlip.side === 'red' ? 'CARA: RED' : 'CRUZ: CHARIZARD'}
          </p>
          <p>{coinFlip.startingPlayerId === player.id ? 'Tu empiezas el combate.' : 'El rival empieza el combate.'}</p>
        </div>
      )}
    </div>
  );
}

function getBattleMessage({
  player,
  opponent,
  coinFlip,
  actionLog,
  systemMessage,
  battleLog,
  gameOver,
  winner,
}: {
  player: Player;
  opponent: Player | null;
  coinFlip: any | null;
  actionLog: string;
  systemMessage: string;
  battleLog: string[];
  gameOver: boolean;
  winner: string | null;
}) {
  if (gameOver) return winner === 'player' ? 'Victoria! Has ganado el combate por el titulo.' : 'Derrota... El combate ha terminado.';
  if (systemMessage) return systemMessage;
  if (actionLog) return actionLog;
  if (coinFlip?.status === 'choosing') {
    return `El campeon ${player.name} reta a ${opponent?.gender === 'female' ? 'la campeona' : 'el campeon'} ${opponent?.name || 'rival'} a una batalla Pokemon por el titulo.`;
  }
  if (battleLog.length > 0) return battleLog[battleLog.length - 1];
  return 'Que comience la batalla Pokemon!';
}

function SwitchMenu({ pokemons, onBack, onSwitch }: { pokemons: BattlePokemon[]; onBack: () => void; onSwitch: (id: number) => void }) {
  return (
    <div class="battlefield-menu-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '8px', color: '#202020' }}>CAMBIAR</h3>
        <button class="battlefield-action-button" onClick={onBack} style={{ width: 'auto' }}>VOLVER</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {pokemons.map((pokemon) => (
          <button
            key={pokemon.id}
            class="battlefield-action-button"
            onClick={() => onSwitch(pokemon.id)}
            disabled={pokemon.isActive || pokemon.isFainted}
          >
            <img src={pokemon.spriteFront} alt={pokemon.name} style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }} />
            <div style={{ fontSize: '7px' }}>{pokemon.name}</div>
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
