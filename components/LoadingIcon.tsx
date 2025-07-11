'use client'

import Image from "next/image";

export default function LoadingIcon() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-[9999]">
      <Image
        src="/icon0.svg"
        alt="App Icon"
        width={100}
        height={100}
        className="animate-spin-fade"
        priority
      />
      <style jsx global>{`
        @keyframes spin-fade {
          0% {
            opacity: 0.3;
            transform: rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: rotate(180deg);
          }
          100% {
            opacity: 0.3;
            transform: rotate(360deg);
          }
        }
        .animate-spin-fade {
          animation: spin-fade 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
} 