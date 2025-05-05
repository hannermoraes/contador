// src/app/page.tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { toast, Toaster } from "sonner"

interface Entry {
  time: string
  date: Date
  note?: string
}

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>([{ time: "00:00", date: new Date(), note: "" }])
  const [total, setTotal] = useState("00:00")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [pause, setPause] = useState("")
  const [pauseType, setPauseType] = useState("min")
  const [worked, setWorked] = useState("00:00")
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<string | undefined>(undefined)

  useEffect(() => {
    const saved = localStorage.getItem("hour-entries")
    if (saved) {
      try {
        const parsed: Entry[] = JSON.parse(saved)
        const sanitized = parsed.map(entry => ({
          ...entry,
          time: entry.time || "00:00",
          date: entry.date ? new Date(entry.date) : new Date(),
          note: entry.note || ""
        }))
        setEntries(sanitized)
      } catch (e) {
        console.error("Erro ao carregar entradas do localStorage", e)
      }
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    setTheme(prefersDark ? "dark" : "light")
  }, [])

  useEffect(() => {
    if (theme) {
      document.documentElement.classList.toggle("dark", theme === "dark")
      localStorage.setItem("theme", theme)
    }
  }, [theme])

  useEffect(() => {
    localStorage.setItem("hour-entries", JSON.stringify(entries))
    calculateTotal()
  }, [entries])

  function calculateTotal() {
    try {
      const totalMin = entries.reduce((acc, { time }) => {
        if (!time) return acc
        const [h, m] = time.split(":" ).map(Number)
        return acc + (h * 60 + m)
      }, 0)

      const h = String(Math.floor(totalMin / 60)).padStart(2, "0")
      const m = String(totalMin % 60).padStart(2, "0")
      setTotal(`${h}:${m}`)
    } catch (e) {
      console.error("Erro ao calcular total:", e)
      setTotal("00:00")
    }
  }

  function addEntry() {
    setEntries([...entries, { time: "00:00", date: new Date(), note: "" }])
    toast.success("Horário adicionado!")
  }

  function updateEntry(index: number, time: string) {
    const updated = [...entries]
    updated[index].time = time || "00:00"
    setEntries(updated)
  }

  function updateNote(index: number, note: string) {
    const updated = [...entries]
    updated[index].note = note
    setEntries(updated)
  }

  function removeEntry(index: number) {
    if (entries.length === 1) return
    setEntries(entries.filter((_, i) => i !== index))
    toast.warning("Horário removido.")
  }

  function clearAll() {
    setEntries([{ time: "00:00", date: new Date(), note: "" }])
    setTotal("00:00")
    toast.info("Entradas limpas.")
  }

  function handleTimeCalc() {
    if (!start || !end) return setWorked("00:00")
    const [startH, startM] = start.split(":" ).map(Number)
    const [endH, endM] = end.split(":" ).map(Number)
    let pauseMin = parseInt(pause || "0")
    if (pauseType === "h") pauseMin *= 60
    const startTotal = startH * 60 + startM
    const endTotal = endH * 60 + endM
    const duration = Math.max(endTotal - startTotal - pauseMin, 0)
    const h = String(Math.floor(duration / 60)).padStart(2, "0")
    const m = String(duration % 60).padStart(2, "0")
    setWorked(`${h}:${m}`)
  }

  function exportText() {
    const text = entries
      .map((e, i) => `Entrada ${i + 1} - ${format(e.date, "dd/MM/yyyy")} - ${e.time}h${e.note ? ` - ${e.note}` : ""}`)
      .join("\n") + `\nTotal: ${total}`

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success("Copiado para área de transferência!")
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <main className="p-6 max-w-4xl mx-auto grid grid-cols-1">
        <div className="space-y-12">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Criar Sign - Recursos Humanos</h1>
            <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Calculadora de Horas</h2>
              {entries.map((entry, idx) => (
                <div key={idx} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <Input
                    type="time"
                    value={entry.time || "00:00"}
                    onChange={(e) => updateEntry(idx, e.target.value)}
                    className="w-[110px]"
                  />
                  <Input
                    type="text"
                    placeholder="Comentário"
                    value={entry.note || ""}
                    onChange={(e) => updateNote(idx, e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="destructive" onClick={() => removeEntry(idx)}>Remover</Button>
                </div>
              ))}

              <Button onClick={addEntry} className="w-full">+ Adicionar Horário</Button>

              <div className="flex justify-between items-center">
                <div className="font-semibold text-lg">Total: {total}</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearAll}>Limpar</Button>
                  <Button variant="secondary" onClick={exportText}>{copied ? "Copiado!" : "Exportar"}</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Calculadora de Tempo</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="start">Hora Início</Label>
                  <Input type="time" id="start" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="end">Hora Fim</Label>
                  <Input type="time" id="end" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Minutos ou horas de pausa"
                  value={pause}
                  onChange={(e) => setPause(e.target.value)}
                />
                <Switch checked={pauseType === "h"} onCheckedChange={(val) => setPauseType(val ? "h" : "min")} />
                <span>{pauseType === "h" ? "Horas" : "Minutos"}</span>
              </div>

              <div className="flex gap-2 justify-between">
                <Button variant="outline" onClick={() => {
                  setStart("")
                  setEnd("")
                  setPause("")
                  setWorked("00:00")
                }}>Limpar</Button>
                <Button onClick={handleTimeCalc}>Calcular</Button>
              </div>

              <div className="font-semibold text-lg">Total trabalhado: {worked}</div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
