"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: { occupation: string; age: number }) => Promise<void>
}

export default function OnboardingModal({ open, onClose, onSave }: Props) {
  const [occupation, setOccupation] = useState("")
  const [age, setAge] = useState<number | "">("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    if (!occupation.trim()) return setError("Please enter your occupation")
    if (!age || Number(age) <= 0) return setError("Please enter a valid age")

    setSaving(true)
    try {
      await onSave({ occupation: occupation.trim(), age: Number(age) })
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome — quick setup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Tell us a bit about yourself so we can tailor scheduling to your needs.</p>

          <div>
            <label className="text-sm">Occupation</label>
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g., Student, Software Engineer" />
          </div>

          <div>
            <label className="text-sm">Age</label>
            <Input value={age?.toString() || ""} onChange={(e) => setAge(Number(e.target.value) || "")} placeholder="e.g., 21" type="number" />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <div className="flex w-full justify-end space-x-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Skip</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
