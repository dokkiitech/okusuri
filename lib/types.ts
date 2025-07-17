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
  notificationsEnabled: boolean // 後方互換性のため保持
  notificationSettings: {
    reminderNotifications: boolean // リマインダー通知（旧notificationsEnabled）
    lowMedicationAlerts: boolean // 残量通知
  }
  createdAt: Date
  updatedAt: Date
}

export interface Medication {
  id: string
  userId: string
  name: string
  dosage?: string
  dosagePerTime: number
  frequency: string[] // 例: ["朝", "昼", "晩", "就寝前", "頓服"]
  prescriptionDays: number
  totalPills: number
  remainingPills: number
  startDate?: Date
  endDate?: Date | null
  notes?: string
  remainingCount?: number // 後方互換性のため保持
  totalCount?: number // 後方互換性のため保持
  takenCount: number
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

