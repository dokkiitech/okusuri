"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Calendar, Home, PillIcon, Settings, Menu, MessageSquare } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("ログアウトエラー:", error)
    }
  }

  const navItems = [
    { href: "/dashboard", label: "ホーム", icon: Home },
    { href: "/medications", label: "お薬", icon: PillIcon },
    { href: "/interaction-check", label: "AIに質問", icon: MessageSquare },
    { href: "/calendar", label: "カレンダー", icon: Calendar },
    { href: "/settings", label: "設定", icon: Settings },
  ]

  if (loading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const NavContent = () => (
    <>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">服薬管理アプリ</h2>
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                  <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start">
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      <div className="px-3 py-2">
        <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>
    </>
  )

  const pageVariants = {
    initial: {
      opacity: 0,
    },
    in: {
      opacity: 1,
    },
    out: {
      opacity: 0,
    },
  }

  const pageTransition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.3, // フェードなので少し短めに調整
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* モバイル用ナビゲーション */}
      {isMobile ? (
        <>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-40">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col justify-between h-full">
                <NavContent />
              </div>
            </SheetContent>
          </Sheet>
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="flex-1 pt-16 px-4 pb-20"
            >
              {children}
            </motion.main>
          </AnimatePresence>
          {/* モバイル用フッターナビゲーション */}
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border h-16 flex items-center justify-around px-2 z-30">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center h-full",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs mt-1">{item.label}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <>
          {/* デスクトップ用サイドバー */}
          <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r">
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-background">
              <div className="flex-1 flex flex-col justify-between">
                <NavContent />
              </div>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="md:pl-64 flex-1 p-8"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

