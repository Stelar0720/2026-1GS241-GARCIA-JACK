interface BattleMenuProps {
  disabled?: boolean;
  onFight: () => void;
  onPokemon: () => void;
  onBag: () => void;
  onRun: () => void;
}

export function BattleMenu({ disabled, onFight, onPokemon, onBag, onRun }: BattleMenuProps) {
  return (
    <div class="action-menu">
      <button
        class="ds-menu-button fight"
        onClick={onFight}
        disabled={disabled}
      >
        <span>FIGHT</span>
        <strong>Atacar</strong>
      </button>
      <button class="ds-menu-button bag" onClick={onBag}>
        <span>BAG</span>
      </button>
      <button class="ds-menu-button run" onClick={onRun}>
        <span>RUN</span>
        <strong>Rendirse</strong>
      </button>
      <button
        class="ds-menu-button pokemon"
        onClick={onPokemon}
        disabled={disabled}
      >
        <span>POKEMON</span>
        <strong>Cambiar</strong>
      </button>
    </div>
  );
}
