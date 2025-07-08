import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { sendLineMessage } from "@/lib/line-handler"
import { sendPushNotification } from "@/lib/notifications"

const REMAINING_PILLS_THRESHOLD_DAYS = 3

export async function POST(request: Request) {
  const { userId, timing, medications, todayRecords, user } = await request.json()

  if (!userId || !timing || !medications || !todayRecords || !user) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
  }

  try {
    const now = new Date()
    const batch = adminDb.batch()

    for (const med of medications) {
      const alreadyTaken = todayRecords.some(
        (r: any) => r.medicationId === med.id && r.scheduledTime === timing && r.status === "taken",
      )

      if (med.frequency.includes(timing) && !alreadyTaken) {
        const recordRef = adminDb.collection("medicationRecords").doc()
        batch.set(recordRef, {
          userId: userId,
          medicationId: med.id,
          medicationName: med.name,
          status: "taken",
          scheduledTime: timing,
          takenAt: now,
          createdAt: now,
          recordedBy: user.uid,
        })

        const newRemainingPills = Math.max(0, med.remainingPills - med.dosagePerTime)
        const newTakenCount = med.takenCount + 1
        const medRef = adminDb.collection("medications").doc(med.id)
        batch.update(medRef, {
          remainingPills: newRemainingPills,
          takenCount: newTakenCount,
          updatedAt: new Date(),
        })

        const dosesPerDay = med.frequency.length * med.dosagePerTime
        if (dosesPerDay > 0) {
          const remainingDays = newRemainingPills / dosesPerDay
          if (remainingDays <= REMAINING_PILLS_THRESHOLD_DAYS) {
            const message = `${med.name}の残りが少なくなっています。残り約${Math.ceil(remainingDays)}日分です。`
            // These functions now need to be callable from the server side.
            // Assuming they are, and they use firebase-admin internally.
            await sendPushNotification(userId, "残薬が少なくなっています", message)
            if (user.lineUid) {
              await sendLineMessage(user.lineUid, message)
            }
          }
        }
      }
    }

    await batch.commit()

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error in record-bulk API route:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
