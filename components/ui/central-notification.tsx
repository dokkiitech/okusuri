"use client"

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CentralNotificationProps {
  message: string;
  duration?: number; // in milliseconds
  onClose: () => void;
}

export const CentralNotification: React.FC<CentralNotificationProps> = ({
  message,
  duration = 1000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
        >
          <div className="bg-black/70 text-white text-2xl font-bold px-8 py-6 rounded-lg shadow-lg text-center max-w-xs sm:max-w-md md:max-w-lg">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
