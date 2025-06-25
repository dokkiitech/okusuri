export interface UserSettings {
  userId: string
  reminderTimes: {
    朝: string
    昼: string
    晩: string
    就寝前: string
    頓服?: string // 頓服を追加し、時刻設定はオプショナルにする
  }
  linkCode: string
  linkedAccounts: string[]
  notificationsEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Medication {
  id: string
  userId: string
  name: string
  dosage: string
  frequency: string[] // 例: ["朝", "昼", "晩", "就寝前", "頓服"]
  startDate: Date
  endDate?: Date | null
  notes?: string
  remainingCount?: number
  totalCount?: number
  createdAt: Date
  updatedAt: Date
}

export interface MedicationLog {
  id: string
  userId: string
  medicationId: string
  takenAt: Date
  scheduled: string // 朝, 昼, 晩, 就寝前, 頓服
  skipped: boolean
  notes?: string
  createdAt: Date
}

