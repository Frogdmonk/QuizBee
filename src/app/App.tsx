import { RouterProvider } from 'react-router/dom';
import { MotionProvider } from './MotionProvider';
import { ToastProvider } from '@/contexts/ToastProvider';
import { router } from './router';

export function App() {
  return (
    <MotionProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </MotionProvider>
  );
}
