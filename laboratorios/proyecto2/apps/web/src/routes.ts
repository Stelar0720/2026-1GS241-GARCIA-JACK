import { createRouter, RouteTree } from '@tanstack/react-start';

export const routeTree: RouteTree = {
  routes: [
    {
      path: '/',
      component: () => import('./routes/index.tsx'),
    },
    {
      path: '/game',
      component: () => import('./routes/game.tsx'),
    },
    {
      path: '/play',
      component: () => import('./routes/play.tsx'),
    },
    {
      path: '/ranking',
      component: () => import('./routes/ranking.tsx'),
    },
    {
      path: '/shop',
      component: () => import('./routes/shop.tsx'),
    },
    {
      path: '/shop/success',
      component: () => import('./routes/shop-success.tsx'),
    },
    {
      path: '/shop/cancel',
      component: () => import('./routes/shop-cancel.tsx'),
    },
    {
      path: '/tutorial',
      component: () => import('./routes/tutorial.tsx'),
    },
  ],
};

export const router = createRouter({ routeTree });
