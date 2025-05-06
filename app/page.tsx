// src/app/page.tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { toast, Toaster } from "sonner"
import { Check, ChevronsUpDown, Trash2, Copy, Clock, Save } from "lucide-react"
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Entry {
  start: string
  end: string
  date: Date
  note?: string
}

interface User {
  name: string
  workStart: string
  workEnd: string
}

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>([{ start: "", end: "", date: new Date(), note: "" }])
  const [total, setTotal] = useState("00:00")
  const [extra, setExtra] = useState("00:00")
  const [theme, setTheme] = useState<string | undefined>(undefined)

  const [user, setUser] = useState<User>({ name: "", workStart: "", workEnd: "" })
  const [users, setUsers] = useState<User[]>([])
  const [comboOpen, setComboOpen] = useState(false)
  const [comboValue, setComboValue] = useState("")

  const [calcStart, setCalcStart] = useState("")
  const [calcEnd, setCalcEnd] = useState("")
  const [pause, setPause] = useState("")
  const [pauseType, setPauseType] = useState("min")
  const [worked, setWorked] = useState("00:00")

  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null)
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<string | null>(null)

  useEffect(() => {
    const savedUsers = localStorage.getItem("users")
    const savedEntries = localStorage.getItem("hour-entries")
    if (savedUsers) setUsers(JSON.parse(savedUsers))
    if (savedEntries) {
      try {
        const parsed: Entry[] = JSON.parse(savedEntries)
        const sanitized = parsed.map(entry => ({
          ...entry,
          date: new Date(entry.date),
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
  }, [entries, user])

  useEffect(() => {
    localStorage.setItem("users", JSON.stringify(users))
  }, [users])

  function timeToMinutes(t: string) {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }

  function minutesToTime(min: number) {
    const h = String(Math.floor(min / 60)).padStart(2, "0")
    const m = String(min % 60).padStart(2, "0")
    return `${h}:${m}`
  }

  function getDurationInMinutes(start: string, end: string) {
    const startMin = timeToMinutes(start)
    const endMin = timeToMinutes(end)
    return endMin >= startMin ? endMin - startMin : (1440 - startMin) + endMin
  }

  function calculateTotal() {
    try {
      let totalMin = 0
      let totalExtra = 0

      const workStartMin = user.workStart ? timeToMinutes(user.workStart) : null
      const workEndMin = user.workEnd ? timeToMinutes(user.workEnd) : null

      entries.forEach(({ start, end }) => {
        if (!start || !end) return
        const duration = getDurationInMinutes(start, end)
        totalMin += duration

        if (workStartMin !== null && workEndMin !== null) {
          const startMin = timeToMinutes(start)
          const endMin = timeToMinutes(end)
          const extraBefore = startMin < workStartMin ? workStartMin - startMin : 0
          const extraAfter = (startMin > endMin || endMin > workEndMin) ? (endMin >= startMin ? endMin - workEndMin : (1440 - workEndMin) + endMin) : 0
          totalExtra += extraBefore + extraAfter
        }
      })

      setTotal(minutesToTime(totalMin))
      setExtra(minutesToTime(totalExtra))
    } catch (e) {
      console.error("Erro ao calcular total:", e)
      setTotal("00:00")
      setExtra("00:00")
    }
  }

  function handleTimeCalc() {
    if (!calcStart || !calcEnd) return setWorked("00:00")
    const pauseMin = pauseType === "h" ? parseInt(pause || "0") * 60 : parseInt(pause || "0")
    const duration = getDurationInMinutes(calcStart, calcEnd) - pauseMin
    setWorked(minutesToTime(Math.max(duration, 0)))
  }

  function addEntry() {
    setEntries([...entries, { start: "", end: "", date: new Date(), note: "" }])
    toast.success("Horário adicionado!")
  }

  function updateEntry(index: number, field: "start" | "end", value: string) {
    const updated = [...entries]
    updated[index][field] = value || ""
    setEntries(updated)
  }

  function removeEntry(index: number) {
    setConfirmRemoveIndex(index)
  }

  function confirmRemoveEntry() {
    if (confirmRemoveIndex !== null) {
      setEntries(entries.filter((_, i) => i !== confirmRemoveIndex))
      toast.warning("Horário removido.")
      setConfirmRemoveIndex(null)
    }
  }

  function duplicateEntry(index: number) {
    const entryToDuplicate = entries[index]
    setEntries([...entries.slice(0, index + 1), { ...entryToDuplicate }, ...entries.slice(index + 1)])
    toast.success("Horário duplicado!")
  }

  function clearAll() {
    setConfirmClear(true)
  }

  function confirmClearAll() {
    setEntries([{ start: "", end: "", date: new Date(), note: "" }])
    setTotal("00:00")
    setExtra("00:00")
    toast.info("Entradas limpas.")
    setConfirmClear(false)
  }

  function addUser() {
    if (!user.name || !user.workStart || !user.workEnd) return toast.error("Preencha todos os campos.")
    const exists = users.find(u => u.name === user.name)
    if (exists) {
      setUsers(users.map(u => (u.name === user.name ? user : u)))
      toast.success("Funcionário atualizado!")
    } else {
      setUsers([...users, user])
      toast.success("Funcionário adicionado!")
    }
  }

  function confirmRemoveUserAction() {
    if (confirmRemoveUser !== null) {
      setUsers(users.filter(u => u.name !== confirmRemoveUser))
      toast.warning(`Funcionário "${confirmRemoveUser}" removido.`)
      if (user.name === confirmRemoveUser) setUser({ name: "", workStart: "", workEnd: "" })
      if (comboValue === confirmRemoveUser) setComboValue("")
      setConfirmRemoveUser(null)
    }
  }

  function selectUser(name: string) {
    const selected = users.find(u => u.name === name)
    if (selected) {
      setUser(selected)
      setComboValue(name)
    }
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      {confirmClear && (
        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar todas as entradas?</AlertDialogTitle>
              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmClearAll}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {confirmRemoveIndex !== null && (
        <AlertDialog open={true} onOpenChange={() => setConfirmRemoveIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover este horário?</AlertDialogTitle>
              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveEntry}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
       {confirmRemoveUser !== null && (
        <AlertDialog open={true} onOpenChange={() => setConfirmRemoveUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover funcionário &quot;{confirmRemoveUser}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveUserAction}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <main className="p-4 sm:p-6 max-w-5xl mx-auto grid grid-cols-1 gap-6">
        <div className="space-y-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold">Criar Sign - Recursos Humanos</h1>
              <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
            </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-2 mt-4 flex-wrap justify-between items-center">
              <h2 className="text-3xl font-bold">Cadastrar Funcionário</h2>
              <div className="flex justify-between gap-2">
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-[250px] justify-between truncate">
                      <span className="truncate max-w-[180px]">{comboValue || "Selecionar funcionário"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar funcionário..." />
                      <CommandList>
                        <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                        <CommandGroup>
                          {users.map((u) => (
                            <CommandItem
                              key={u.name}
                              value={u.name}
                              onSelect={(currentValue) => {
                                selectUser(currentValue)
                                setComboOpen(false)
                              }}>
                              {u.name}
                              <Check className={cn("ml-auto h-4 w-4", comboValue === u.name ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2 flex-row-reverse">
                {user.name && users.some(u => u.name === user.name) && (
                  <Button variant="destructive" onClick={() => setConfirmRemoveUser(user.name)}>
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
                  <Button variant="default" onClick={addUser}>
                  <Save className="w-5 h-5" />
                  Salvar
                  </Button>
                </div>
              </div>

              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                <Label htmlFor="Name" className="p-2">Nome</Label>
                  <Input placeholder="Nome" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} />
                </div>
                <div>
                <Label htmlFor="timeStart" className="p-2">Início</Label>
                  <Input type="time" value={user.workStart} onChange={(e) => setUser({ ...user, workStart: e.target.value })} />
                </div>
                <div>
                <Label htmlFor="timeEnd" className="p-2">Fim</Label>
                  <Input type="time" value={user.workEnd} onChange={(e) => setUser({ ...user, workEnd: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4"> 
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-xl font-bold">Calculadora de Horas</h2>
              </div>
              <div className="flex flex-col gap-4">
                {entries.map((entry, idx) => {
                  const crossDay = entry.start && entry.end && timeToMinutes(entry.end) < timeToMinutes(entry.start)
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex gap-2">
                        <div className="relative w-full sm:w-[310px]">
                          <input
                            type="time"
                            value={entry.start}
                            onChange={(e) => updateEntry(idx, "start", e.target.value)}
                            className="w-full sm:w-[310px] pr-3 pl-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          />
                          <Clock className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="relative w-full sm:w-[310px]">
                            <input
                              type="time"
                              value={entry.end}
                              onChange={(e) => updateEntry(idx, "end", e.target.value)}
                              className="w-full sm:w-[310px] pr-3 pl-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                            />
                          <Clock className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        </div>
                          <div className="flex items-center justify-between gap-2">
                            {crossDay ? (
                              <Badge variant="secondary" className="text-xs"><span className="text-emerald-500 dark:text-emerald-300">+</span> 24h</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs"><span className="text-gray-700 dark:text-gray-400">-</span> 24h</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => duplicateEntry(idx)} className="text-neutral-700 hover:text-neutral-700 dark:text-zinc-200">
                         Duplicar <Copy className="w-5 h-5" />
                        </Button>
                        <Button variant="secondary" onClick={() => removeEntry(idx)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button onClick={addEntry} className="w-full">+ Adicionar Horário</Button>
              <div className="flex flex-col sm:flex-row justify-between gap-2">
                <div className="font-semibold text-lg">Total: {total}</div>
                <div className="font-semibold text-lg">Extras: {extra}</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearAll}>Limpar</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Calculadora de Tempo</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  type="time"
                  value={calcStart}
                  onChange={(e) => setCalcStart(e.target.value)}
                  placeholder="Início"
                />
                <Input
                  type="time"
                  value={calcEnd}
                  onChange={(e) => setCalcEnd(e.target.value)}
                  placeholder="Fim"
                />
              </div>
              {calcStart && calcEnd && timeToMinutes(calcEnd) < timeToMinutes(calcStart) && (
                <Badge variant="destructive" className="text-xs">Estamos no dia seguinte</Badge>
              )}
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
                  setCalcStart("")
                  setCalcEnd("")
                  setPause("")
                  setWorked("00:00")
                }}>Limpar</Button>
                <Button onClick={handleTimeCalc}>Calcular</Button>
              </div>
              <div className="font-semibold text-lg">Total: {worked}</div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
