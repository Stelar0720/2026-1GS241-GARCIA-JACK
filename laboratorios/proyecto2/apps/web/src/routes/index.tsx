import { Link } from '@tanstack/react-start';
import { createRootRoute } from '@tanstack/react-start';

export const Route = createRootRoute({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="peak-title text-4xl text-amber-900 mb-2">
            C H E C K E R S
          </h1>
          <p className="peak-text text-xl text-amber-700">
            Classical Board Game v2.0
          </p>
        </header>

        {/* Instrucciones */}
        <div className="peak-paper peak-border p-6 mb-6">
          <div className="text-center peak-text text-lg text-gray-700">
            <p className="mb-2">IA A* con 3 niveles de dificultad</p>
            <p> ranking global por movimientos</p>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="space-y-4">
          <Link to="/game" className="block">
            <button className="peak-button w-full text-xl py-6">
              Nueva Partida
            </button>
          </Link>

          <Link to="/ranking" className="block">
            <button className="peak-button w-full text-xl py-4">
              Ver Ranking
            </button>
          </Link>

          <Link to="/tutorial" className="block">
            <button className="peak-button w-full text-xl py-4">
              Como Jugar
            </button>
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center peak-text text-sm text-gray-600">
          <p>TanStack Start + Hono + Bun + SQLite</p>
        </footer>
      </div>
    </div>
  );
}
