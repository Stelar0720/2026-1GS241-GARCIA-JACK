import { extendsConfig } from '@tanstack/react-start/config';
import { defineConfig } from 'vinxi';

export default extendsConfig(
  defineConfig({
    router: {
      type: 'hash'
    },
    server: {
      routeFile: 'src/routes.ts'
    },
    build: {
      target: 'browser'
    },
    resolve: {
      alias: {
        '~': './src'
      }
    }
  }),
  {}
);
