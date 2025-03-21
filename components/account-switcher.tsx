"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface LinkedAccount {
  uid: string
  displayName: string
}

interface AccountSwitcherProps {
  currentUserId: string
  onAccountChange: (userId: string) => void
}

export function AccountSwitcher({ currentUserId, onAccountChange }: AccountSwitcherProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !db) return

    const fetchLinkedAccounts = async () => {
      try {
        setLoading(true)
        // 自分のユーザー設定を取得
        const settingsDoc = await getDoc(doc(db, "userSettings", user.uid))

        if (settingsDoc.exists()) {
          const settings = settingsDoc.data()
          const linkedAccountIds = settings.linkedAccounts || []

          // 自分自身のアカウント情報
          const myAccount: LinkedAccount = {
            uid: user.uid,
            displayName: user.displayName || "自分",
          }

          const linkedAccounts: LinkedAccount[] = [myAccount]

          // 連携アカウントの詳細情報を取得
          for (const accountId of linkedAccountIds) {
            try {
              const userDoc = await getDoc(doc(db, "users", accountId))
              if (userDoc.exists()) {
                linkedAccounts.push({
                  uid: accountId,
                  displayName: userDoc.data().displayName || "名前なし",
                })
              }
            } catch (error) {
              console.error("連携アカウント情報の取得に失敗しました:", error)
            }
          }

          setAccounts(linkedAccounts)
        } else {
          // 設定がない場合は自分のアカウントのみ
          setAccounts([
            {
              uid: user.uid,
              displayName: user.displayName || "自分",
            },
          ])
        }
      } catch (error) {
        console.error("連携アカウント情報の取得に失敗しました:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLinkedAccounts()
  }, [user, db])

  if (loading || accounts.length <= 1) {
    return null
  }

  const selectedAccount = accounts.find((account) => account.uid === currentUserId) || accounts[0]

  return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            <User className="mr-2 h-4 w-4" />
            {selectedAccount.displayName}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="アカウントを検索..." />
            <CommandList>
              <CommandEmpty>アカウントが見つかりません</CommandEmpty>
              <CommandGroup>
                {accounts.map((account) => (
                    <CommandItem
                        key={account.uid}
                        value={account.uid}
                        onSelect={() => {
                          onAccountChange(account.uid)
                          setOpen(false)
                        }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", currentUserId === account.uid ? "opacity-100" : "opacity-0")} />
                      {account.displayName}
                    </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
  )
}

