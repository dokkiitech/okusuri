import React from 'react';
import ReactDOM from 'react-dom/client';
import { CentralNotification } from '@/components/ui/central-notification';

export function showCentralNotification(message: string, duration?: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);

  const onClose = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    <CentralNotification message={message} duration={duration} onClose={onClose} />
  );
}