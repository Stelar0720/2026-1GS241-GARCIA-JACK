import { RouterProvider } from '@tanstack/react-start';
import { router } from './routes';
import './lib/styles/index.css';

export function App() {
  return <RouterProvider router={router} />;
}
