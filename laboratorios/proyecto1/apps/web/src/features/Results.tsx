// Sinnoh Edition - Results Screen
import type { Player } from '../App';
import { isGodModeActive, getGodModeEndMessage } from '../lib/api';

interface ResultsProps {
  player: Player | null;
  playerTeam: any[];
  opponentTeam: any[];
  onPlayAgain: () => void;
}

export function Results({ player, playerTeam, opponentTeam, onPlayAgain }: ResultsProps) {
  // Check God Mode status
  const godModeActive = isGodModeActive();
  const godMessage = godModeActive ? getGodModeEndMessage() : '';

  // Determine winner based on team survival
  const playerFainted = playerTeam.filter(p => p.isFainted).length;
  const opponentFainted = opponentTeam.filter(p => p.isFainted).length;
  const playerWon = playerFainted < opponentFainted || playerTeam.length === 0;

  return (
    <div class="screen results">
      <div class="ds-panel" style={{ textAlign: 'center' }}>
        {/* God Mode Banner */}
        {godModeActive && (
          <div style={{
            background: 'linear-gradient(180deg, #2a1a0a 0%, #1a1a2e 100%)',
            border: '2px solid #e0c030',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '10px', color: '#e0c030' }}>✨ DIOS MODO ACTIVADO ✨</p>
            <p style={{ fontSize: '8px', color: '#a8a8c8', marginTop: '4px' }}>
              {godMessage || 'Aparentemente este campeón sí cobra sueldo XD'}
            </p>
          </div>
        )}

        {/* Result Title */}
        <div style={{ 
          background: playerWon ? 'linear-gradient(180deg, #e0c030 0%, #b0a020 100%)' : 'linear-gradient(180deg, #4a4a8a 0%, #3a3a6a 100%)',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ 
            fontSize: '20px', 
            color: playerWon ? '#1a1a2e' : '#fff',
            textShadow: playerWon ? 'none' : '2px 2px 0 #1a1a2e'
          }}>
            {playerWon ? '¡VICTORIA!' : 'DERROTA'}
          </p>
          <p style={{ 
            fontSize: '10px', 
            marginTop: '8px',
            color: playerWon ? '#1a1a2e' : '#a8a8c8'
          }}>
            {player?.name || 'Jugador'} vs {playerWon ? 'Oponente' : 'Tú'}
          </p>
        </div>

        {/* Battle Summary */}
        <div class="ds-textbox" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '10px', marginBottom: '12px', color: '#e0c030' }}>
            RESUMEN DE BATALLA
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left' }}>
            <div>
              <p style={{ fontSize: '8px', color: '#a8a8c8', marginBottom: '8px' }}>TU EQUIPO</p>
              {playerTeam.map((p, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '4px',
                  opacity: p.isFainted ? 0.5 : 1
                }}>
                  <img 
                    src={p.spriteFront}
                    alt={p.name}
                    style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                  />
                  <span style={{ fontSize: '8px' }}>{p.name}</span>
                  {p.isFainted && <span style={{ fontSize: '7px', color: '#c03030' }}>K.O.</span>}
                </div>
              ))}
            </div>
            
            <div>
              <p style={{ fontSize: '8px', color: '#a8a8c8', marginBottom: '8px' }}>EQUIPO OPONENTE</p>
              {opponentTeam.map((p, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '4px',
                  opacity: p.isFainted ? 0.5 : 1
                }}>
                  <img 
                    src={p.spriteFront}
                    alt={p.name}
                    style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                  />
                  <span style={{ fontSize: '8px' }}>{p.name}</span>
                  {p.isFainted && <span style={{ fontSize: '7px', color: '#c03030' }}>K.O.</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trophy Section (if applicable) */}
        {checkTrophy(playerTeam) && (
          <div class="ds-textbox" style={{ 
            background: 'linear-gradient(180deg, #2a2a4a 0%, #1a1a2e 100%)',
            borderColor: '#e0c030',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '12px' }}>🏆 {getTrophyMessage()}</p>
          </div>
        )}

        {/* God Mode Special Victory Message */}
        {godModeActive && playerWon && (
          <div class="ds-textbox" style={{
            background: 'linear-gradient(180deg, #3a2a1a 0%, #2a1a0a 100%)',
            borderColor: '#e0c030',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '10px', color: '#e0c030' }}>
              🎴 Con la tarjeta de crédito activa, esta victoria cuenta doble.
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button class="ds-button" onClick={() => window.location.reload()}>
            VOLVER AL INICIO
          </button>
          <button class="ds-button gold" onClick={onPlayAgain}>
            JUGAR OTRA
          </button>
        </div>
      </div>
    </div>
  );
}

function checkTrophy(team: any[]): boolean {
  if (team.length === 0) return false;
  // Check if all pokemon are from generation 4 (Sinnoh)
  return team.every(p => p.id >= 387 && p.id <= 493);
}

function getTrophyMessage(): string {
  return 'Campeón de Cultura\nHas elegido el camino correcto. Sinnoh aprueba tu equipo.';
}