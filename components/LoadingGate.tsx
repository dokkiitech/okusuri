'use client'
import { ReactNode } from "react";
import { useLoading } from "@/contexts/loading-context";
import LoadingIcon from "@/components/LoadingIcon";

export default function LoadingGate({ children }: { children: ReactNode }) {
  const { loading } = useLoading();
  return (
    <>
      {loading && <LoadingIcon />}
      {children}
    </>
  );
} 