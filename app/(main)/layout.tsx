"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Calendar, Home, PillIcon, Settings, Menu, MessageSquare, LogOut, User } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
    { href: "/interaction-check", label: "AIに相談", icon: MessageSquare },
    { href: "/calendar", label: "カレンダー", icon: Calendar },
    { href: "/settings", label: "設定", icon: Settings },
  ]

  if (loading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const NavContent = () => (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-2 mb-8">
          <PillIcon className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold">のむRhythm</h1>
        </Link>
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={() => isMobile && setIsOpen(false)}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start text-base h-12"
                  >
                    <Icon className="mr-4 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="mt-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{user.displayName || "User"}</span>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
        </div>
        <Button variant="outline" className="w-full justify-start h-12" onClick={handleLogout}>
          <LogOut className="mr-4 h-5 w-5" />
          ログアウト
        </Button>
      </div>
    </nav>
  )

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 },
  }

  const pageTransition = {
    type: "easeInOut",
    duration: 0.4,
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isMobile ? (
        <>
          <header className="fixed top-0 left-0 right-0 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur-sm border-b z-40">
            <Link href="/dashboard" className="flex items-center gap-2">
              <PillIcon className="h-6 w-6 text-primary" />
              <span className="font-bold">のむリズム</span>
            </Link>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <NavContent />
              </SheetContent>
            </Sheet>
          </header>
          <main className="pt-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
                className="p-4 sm:p-6"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      ) : (
        <div className="flex">
          <aside className="fixed top-0 left-0 w-64 h-full border-r">
            <NavContent />
          </aside>
          <main className="ml-64 w-[calc(100%-16rem)]">
             <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
                className="p-8"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      )}
    </div>
  )
}