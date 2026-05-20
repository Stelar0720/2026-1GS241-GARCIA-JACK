import './battlefield.css';
import type { ComponentChildren } from 'preact';
import { BattleMenu } from './BattleMenu';
import { battleBackgrounds, DEFAULT_BATTLE_BACKGROUND, type SpriteCrop } from './battleBackgrounds';

interface BattleFieldPokemon {
  name: string;
  spriteFront?: string;
  spriteBack?: string;
  currentHp: number;
  maxHp: number;
  isFainted?: boolean;
}

interface BattleFieldProps {
  playerPokemon: BattleFieldPokemon | null;
  enemyPokemon: BattleFieldPokemon | null;
  playerTeam: BattleFieldPokemon[];
  enemyTeam: BattleFieldPokemon[];
  pokeballUrl?: string;
  pokeballDefeatedUrl?: string;
  message: string;
  isMyTurn: boolean;
  backgroundId?: string;
  overlay?: ComponentChildren;
  menuContent?: ComponentChildren;
  onAttack: () => void;
  onSwitch: () => void;
  onBag: () => void;
  onRun: () => void;
}

const backgroundModules = import.meta.glob('../../../../../sprites/background/*Battle Backgrounds*.{png,jpg,jpeg,PNG,JPG,JPEG}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const battleBackgroundUrl = Object.values(backgroundModules)[0] || '';

const lowerUiModules = import.meta.glob('../../../../../sprites/background/*Lower DS Screen Battle System*.{png,jpg,jpeg,PNG,JPG,JPEG}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const lowerUiUrl = Object.values(lowerUiModules)[0] || '';

export function BattleField({
  playerPokemon,
  enemyPokemon,
  playerTeam,
  enemyTeam,
  pokeballUrl,
  pokeballDefeatedUrl,
  message,
  isMyTurn,
  backgroundId = DEFAULT_BATTLE_BACKGROUND,
  overlay,
  menuContent,
  onAttack,
  onSwitch,
  onBag,
  onRun,
}: BattleFieldProps) {
  const background = battleBackgrounds[backgroundId] || battleBackgrounds[DEFAULT_BATTLE_BACKGROUND];

  return (
    <div class="battle-shell">
      <div class="battle-stage">
        <div class="battle-console" style={{ '--lower-ui-sheet': lowerUiUrl ? `url("${lowerUiUrl}")` : undefined }}>
          <div class="top-screen">
            <div class="battle-field">
            <SpriteCropDiv className="battle-background" crop={background.background} scale={2.5} />

            {overlay}

            <SpriteCropDiv
              className="enemy-platform"
              crop={background.platformEnemy}
              scale={background.platformEnemyPosition.scale}
              style={{
                left: `${background.platformEnemyPosition.left}px`,
                top: `${background.platformEnemyPosition.top}px`,
              }}
            />
            <SpriteCropDiv
              className="player-platform"
              crop={background.platformPlayer}
              scale={background.platformPlayerPosition.scale}
              style={{
                left: `${background.platformPlayerPosition.left}px`,
                top: `${background.platformPlayerPosition.top}px`,
              }}
            />

            <TeamBalls team={enemyTeam} side="enemy" pokeballUrl={pokeballUrl} pokeballDefeatedUrl={pokeballDefeatedUrl} />
            <TeamBalls team={playerTeam} side="player" pokeballUrl={pokeballUrl} pokeballDefeatedUrl={pokeballDefeatedUrl} />

            {enemyPokemon && (
              <>
                <HpBox pokemon={enemyPokemon} side="enemy" />
                <img class="enemy-pokemon" src={enemyPokemon.spriteFront} alt={enemyPokemon.name} />
              </>
            )}

            {playerPokemon && (
              <>
                <img class="player-pokemon" src={playerPokemon.spriteBack || playerPokemon.spriteFront} alt={playerPokemon.name} />
                <HpBox pokemon={playerPokemon} side="player" />
              </>
            )}

            {message && (
              <div class="mini-dialog-overlay">
                <p>{message}</p>
              </div>
            )}
            </div>
          </div>

          <div class="bottom-screen">
            <div class="action-menu-full">
              {menuContent || (
                <BattleMenu
                  disabled={!isMyTurn}
                  onFight={onAttack}
                  onPokemon={onSwitch}
                  onBag={onBag}
                  onRun={onRun}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpriteCropDiv({
  crop,
  scale,
  className,
  style,
}: {
  crop: SpriteCrop;
  scale: number;
  className: string;
  style?: Record<string, string>;
}) {
  return (
    <div
      class={className}
      style={{
        ...style,
        width: `${crop.width}px`,
        height: `${crop.height}px`,
        backgroundImage: battleBackgroundUrl ? `url("${battleBackgroundUrl}")` : undefined,
        backgroundPosition: `${-crop.x}px ${-crop.y}px`,
        transform: `scale(${scale})`,
      }}
    />
  );
}

function HpBox({ pokemon, side }: { pokemon: BattleFieldPokemon; side: 'enemy' | 'player' }) {
  const hpPercent = Math.max(0, Math.min(100, (pokemon.currentHp / pokemon.maxHp) * 100));

  return (
    <div class={`battle-hp ${side}`}>
      <div class="battle-hp-row">
        <span class="battle-hp-name">{pokemon.name}</span>
        <span>Lv.50</span>
      </div>
      <div class="battle-hp-track">
        <div
          class={`battle-hp-fill ${hpPercent < 20 ? 'critical' : hpPercent < 50 ? 'warning' : ''}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <div class="battle-hp-count">{pokemon.currentHp}/{pokemon.maxHp}</div>
    </div>
  );
}

function TeamBalls({
  team,
  side,
  pokeballUrl,
  pokeballDefeatedUrl,
}: {
  team: BattleFieldPokemon[];
  side: 'enemy' | 'player';
  pokeballUrl?: string;
  pokeballDefeatedUrl?: string;
}) {
  return (
    <div class={`team-balls ${side}`}>
      {Array.from({ length: 6 }, (_, i) => {
        const pokemon = team[i];
        const src = pokemon?.isFainted ? pokeballDefeatedUrl : pokeballUrl;
        return (
          <img
            key={i}
            class="team-ball"
            src={src}
            alt=""
            style={{ opacity: pokemon ? 1 : 0.25 }}
          />
        );
      })}
    </div>
  );
}
