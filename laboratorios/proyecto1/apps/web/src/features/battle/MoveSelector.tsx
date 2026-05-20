interface MoveSelectorProps {
  moves: any[];
  onMove: (index: number) => void;
  onCancel: () => void;
}

export function MoveSelector({ moves, onMove, onCancel }: MoveSelectorProps) {
  return (
    <div class="move-menu">
      <div class="move-grid">
        {Array.from({ length: 4 }, (_, index) => {
          const move = moves[index];
          const type = normalizeType(move?.type);
          return (
            <button
              key={index}
              class={`move-button type-${type} ${move ? '' : 'empty'}`}
              disabled={!move || move.pp <= 0}
              onClick={() => move && onMove(index)}
            >
              {move && (
                <>
                  <span class="move-name">{move.name}</span>
                  <span class="move-type">{String(move.type || '???').toUpperCase()}</span>
                  <span class="move-pp">{formatMoveNumbers(move)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <button class="move-cancel" onClick={onCancel}>
        CANCEL
      </button>
    </div>
  );
}

function normalizeType(type: string | undefined) {
  return String(type || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function formatMoveNumbers(move: any) {
  const current = move.pp;
  const max = move.maxPp ?? move.maxPP ?? move.max_pp;
  if (current !== undefined && max !== undefined) return `${current} / ${max}`;
  if (current !== undefined) return String(current);
  if (move.power !== undefined) return String(move.power);
  return '';
}
