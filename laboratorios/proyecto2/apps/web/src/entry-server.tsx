import { createHandler, StartServer } from '@tanstack/react-start/server';

export default createHandler({
  router: () => import('./routes').then(m => m.router),
  createStartRouter: (opts) => new StartServer({ ...opts }),
});
