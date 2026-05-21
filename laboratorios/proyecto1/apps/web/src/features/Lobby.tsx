// Sinnoh Edition - Lobby Screen with WebSocket + Battle Pass Zone
import { useEffect, useState } from 'preact/hooks';
import { useClerk, useUser } from '@clerk/clerk-react';
import type { Player, Room } from '../App';
import { createBattlePassCheckout, hasBattlePass, isGodModeActive, syncBattlePassState, toggleGodMode } from '../lib/api';

interface LobbyProps {
  player: Player;
  room: Room | null;
  opponent: Player | null;
  isOpponentReady: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onReady: () => void;
  isConnected: boolean;
  authEnabled: boolean;
  authUserId: string | null;
}

interface BattlePassControlsProps {
  authEnabled: boolean;
  battlePassUnlocked: boolean;
  godModeActive: boolean;
  purchasing: boolean;
  onPurchaseStart: () => void;
  onPurchaseEnd: () => void;
  onToggleGodMode: () => void;
}

export function Lobby({
  player,
  room,
  opponent,
  isOpponentReady,
  onCreateRoom,
  onJoinRoom,
  onReady,
  isConnected,
  authEnabled,
  authUserId,
}: LobbyProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [joinCode, setJoinCode] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [battlePassUnlocked, setBattlePassUnlocked] = useState(hasBattlePass());
  const [godModeActive, setGodModeActive] = useState(isGodModeActive());
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    if (!room) setMode('select');
    setBattlePassUnlocked(hasBattlePass(authUserId));
    setGodModeActive(isGodModeActive(authUserId));

    if (authUserId) {
      syncBattlePassState(authUserId).then((state) => {
        if (cancelled) return;
        setBattlePassUnlocked(state.unlocked);
        setGodModeActive(state.godModeActive);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [room?.id, authUserId]);

  const handleToggleGodMode = () => {
    const newState = toggleGodMode(authUserId);
    setGodModeActive(newState);
  };

  const handleJoinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    onJoinRoom(code);
  };

  const handleReady = () => {
    setIsReady(true);
    onReady();
  };

  return (
    <div class="screen lobby">
      <div class="ds-panel">
        <h2 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '20px', color: '#d9c25f' }}>
          LOBBY
        </h2>

        {!isConnected && (
          <div class="ds-textbox" style={{ background: '#3a2020', borderColor: '#d84040', marginBottom: '16px' }}>
            <p style={{ textAlign: 'center', color: '#d84040' }}>
              No conectado al servidor. Esperando...
            </p>
          </div>
        )}

        <div style={{
          background: 'var(--sinnoh-deep)',
          border: '2px solid var(--sinnoh-gold)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <h3 style={{
            fontSize: '10px',
            color: 'var(--sinnoh-gold)',
            marginBottom: '12px',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            ZONA DE CAMPEONATO
          </h3>

          {authEnabled ? (
            <ClerkBattlePassControls
              authEnabled={authEnabled}
              battlePassUnlocked={battlePassUnlocked}
              godModeActive={godModeActive}
              purchasing={purchasing}
              onPurchaseStart={() => setPurchasing(true)}
              onPurchaseEnd={() => setPurchasing(false)}
              onToggleGodMode={handleToggleGodMode}
            />
          ) : (
            <BattlePassControls
              authEnabled={authEnabled}
              battlePassUnlocked={battlePassUnlocked}
              godModeActive={godModeActive}
              purchasing={purchasing}
              onPurchaseStart={() => setPurchasing(true)}
              onPurchaseEnd={() => setPurchasing(false)}
              onToggleGodMode={handleToggleGodMode}
            />
          )}
        </div>

        {!room && mode === 'select' && (
          <div class="ds-textbox">
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>
              Que deseas hacer?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button class="ds-button gold" onClick={onCreateRoom} disabled={!isConnected}>
                CREAR SALA
              </button>
              <button class="ds-button" onClick={() => setMode('join')} disabled={!isConnected}>
                UNIRSE A SALA
              </button>
            </div>
          </div>
        )}

        {!room && mode === 'join' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '12px' }}>Ingresa el codigo de sala:</p>
            <input
              type="text"
              class="ds-input"
              placeholder="ABCDEF"
              value={joinCode}
              onInput={(e) => setJoinCode((e.target as HTMLInputElement).value.toUpperCase())}
              maxLength={6}
              style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '8px', marginBottom: '16px' }}
            />
            <div class="nav-buttons">
              <button class="ds-button" onClick={() => setMode('select')}>
                ATRAS
              </button>
              <button class="ds-button gold" onClick={handleJoinRoom} disabled={joinCode.length !== 6}>
                UNIRSE
              </button>
            </div>
          </div>
        )}

        {room && (
          <div class="ds-textbox">
            <p style={{ textAlign: 'center', marginBottom: '12px' }}>Codigo de sala:</p>
            <div class="lobby-code">{room.code}</div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', marginBottom: '8px', color: 'var(--sinnoh-text-dim)' }}>TU</p>
                <div style={{
                  background: 'var(--sinnoh-deep)',
                  padding: '12px',
                  borderRadius: '4px',
                  border: isReady ? '2px solid var(--sinnoh-success)' : '2px solid var(--sinnoh-border)',
                }}>
                  <img src={player.spriteUrl} alt={player.name} style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                  <p style={{ fontSize: '9px', marginTop: '4px' }}>{player.name}</p>
                  {isReady && <p style={{ fontSize: '8px', color: 'var(--sinnoh-success)' }}>LISTO</p>}
                </div>
              </div>

              <div style={{ alignSelf: 'center', fontSize: '24px', color: 'var(--sinnoh-text-dim)' }}>VS</div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', marginBottom: '8px', color: 'var(--sinnoh-text-dim)' }}>
                  {opponent ? 'OPONENTE' : 'ESPERANDO...'}
                </p>
                <div style={{
                  background: 'var(--sinnoh-deep)',
                  padding: '12px',
                  borderRadius: '4px',
                  minWidth: '80px',
                  minHeight: '80px',
                  border: isOpponentReady ? '2px solid var(--sinnoh-success)' : '2px solid var(--sinnoh-border)',
                }}>
                  {opponent ? (
                    <>
                      <img
                        src={opponent.spriteUrl}
                        alt="Opponent"
                        style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <p style={{ fontSize: '9px', marginTop: '4px' }}>{opponent.name}</p>
                      {isOpponentReady && <p style={{ fontSize: '8px', color: 'var(--sinnoh-success)' }}>LISTO</p>}
                    </>
                  ) : (
                    <div style={{ fontSize: '24px', lineHeight: '80px', color: 'var(--sinnoh-text-dim)' }}>?</div>
                  )}
                </div>
              </div>
            </div>

            <div class="nav-buttons">
              {!opponent ? (
                <div style={{ padding: '12px', color: 'var(--sinnoh-text-dim)' }}>
                  Esperando oponente...
                </div>
              ) : !isReady ? (
                <button class="ds-button gold" onClick={handleReady}>
                  ESTOY LISTO
                </button>
              ) : !isOpponentReady ? (
                <div style={{ padding: '12px', color: 'var(--sinnoh-text-dim)' }}>
                  Esperando que tu oponente este listo...
                </div>
              ) : (
                <div style={{ padding: '12px', color: 'var(--sinnoh-success)' }}>
                  Iniciando fase de ban...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClerkBattlePassControls(props: BattlePassControlsProps) {
  const { isSignedIn, user } = useUser();
  const { openSignIn, signOut } = useClerk();

  const handleBuyBattlePass = async () => {
    if (!isSignedIn) {
      openSignIn({
        afterSignInUrl: window.location.href,
        afterSignUpUrl: window.location.href,
      });
      return;
    }

    props.onPurchaseStart();
    const result = await createBattlePassCheckout({
      userId: user?.id,
      email: user?.primaryEmailAddress?.emailAddress,
    });

    if ('url' in result) {
      window.location.href = result.url;
      return;
    }

    alert(result.error);
    props.onPurchaseEnd();
  };

  return (
    <BattlePassControls
      {...props}
      isSignedIn={Boolean(isSignedIn)}
      userEmail={user?.primaryEmailAddress?.emailAddress}
      onSignIn={() => openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href })}
      onSignOut={() => signOut()}
      onBuyBattlePass={handleBuyBattlePass}
    />
  );
}

function BattlePassControls({
  authEnabled,
  battlePassUnlocked,
  godModeActive,
  purchasing,
  onToggleGodMode,
  onSignIn,
  onSignOut,
  onBuyBattlePass,
  isSignedIn = false,
  userEmail,
}: BattlePassControlsProps & {
  isSignedIn?: boolean;
  userEmail?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onBuyBattlePass?: () => void;
}) {
  if (!battlePassUnlocked) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '9px', color: 'var(--sinnoh-text)', marginBottom: '12px', lineHeight: 1.6 }}>
          Desbloquea el Battle Pass por $1000 USD y accede a Pokemon shiny y al Arceus canonico.
        </p>

        {authEnabled && !isSignedIn && (
          <button class="ds-button gold" onClick={onSignIn} style={{ width: '100%' }}>
            INICIAR SESION PARA COMPRAR
          </button>
        )}

        {authEnabled && isSignedIn && (
          <>
            <p style={{ fontSize: '7px', color: 'var(--sinnoh-text-dim)', marginBottom: '8px' }}>
              Sesion: {userEmail || 'cuenta Clerk'}
            </p>
            <button class="ds-button gold" onClick={onBuyBattlePass} disabled={purchasing} style={{ width: '100%' }}>
              {purchasing ? 'PROCESANDO...' : 'COMPRAR BATTLE PASS'}
            </button>
            <button class="ds-button" onClick={onSignOut} disabled={purchasing} style={{ width: '100%', marginTop: '8px' }}>
              CERRAR SESION
            </button>
          </>
        )}

        {!authEnabled && (
          <p style={{ fontSize: '8px', color: 'var(--sinnoh-danger)', lineHeight: 1.6 }}>
            Compra desactivada: falta configurar VITE_CLERK_PUBLISHABLE_KEY en .env.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {authEnabled && isSignedIn && (
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: '7px', color: 'var(--sinnoh-text-dim)' }}>
            Sesion: {userEmail || 'cuenta Clerk'}
          </p>
          <button class="ds-button" onClick={onSignOut} style={{ padding: '8px 10px', fontSize: '7px' }}>
            CERRAR SESION
          </button>
        </div>
      )}

      <div style={{
        background: 'var(--sinnoh-navy)',
        border: '2px solid var(--sinnoh-success)',
        borderRadius: '4px',
        padding: '12px',
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '8px', color: 'var(--sinnoh-success)' }}>
          BATTLE PASS ACTIVADO
        </p>
      </div>

      <div style={{
        background: godModeActive ? 'var(--sinnoh-blue)' : 'var(--sinnoh-navy)',
        border: `2px solid ${godModeActive ? 'var(--sinnoh-gold)' : 'var(--sinnoh-border)'}`,
        borderRadius: '4px',
        padding: '12px',
      }}>
        <h4 style={{
          fontSize: '10px',
          color: godModeActive ? 'var(--sinnoh-gold)' : 'var(--sinnoh-text-dim)',
          marginBottom: '8px',
          textAlign: 'center',
        }}>
          DIOS TARJETA DE CREDITO
        </h4>
        <p style={{ fontSize: '8px', color: 'var(--sinnoh-text-dim)', marginBottom: '10px', textAlign: 'center' }}>
          Activa para usar Pokemon shiny y acceder al Arceus canonico.
        </p>
        <button class={`ds-button ${godModeActive ? 'gold' : ''}`} onClick={onToggleGodMode} style={{ width: '100%' }}>
          {godModeActive ? 'ACTIVO' : 'ACTIVAR'}
        </button>
      </div>
    </div>
  );
}
