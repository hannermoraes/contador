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
  const defaultEntry = () => [{ start: "", end: "", date: new Date(), note: "" }]
  const FALLBACK_USER = "__default__"

  const [entries, setEntries] = useState<Entry[]>(defaultEntry())
  const [entriesByUser, setEntriesByUser] = useState<Record<string, Entry[]>>({})
  const [total, setTotal] = useState("00:00")
  const [extra, setExtra] = useState("00:00")
  const [theme, setTheme] = useState<string | undefined>(undefined)

  const [user, setUser] = useState<User>({ name: "", workStart: "", workEnd: "" })
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<string>("")
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
    const sanitizeEntries = (data: unknown): Entry[] => {
      if (!Array.isArray(data)) return defaultEntry()
      return data.map(entry => ({
        start: entry?.start || "",
        end: entry?.end || "",
        date: entry?.date ? new Date(entry.date) : new Date(),
        note: entry?.note || ""
      }))
    }

    const savedUsersRaw = localStorage.getItem("users")
    const parsedUsers: User[] = savedUsersRaw ? JSON.parse(savedUsersRaw) : []
    if (parsedUsers.length) setUsers(parsedUsers)

    const savedMap = localStorage.getItem("hour-entries-by-user")
    const savedLegacy = localStorage.getItem("hour-entries")
    let initialMap: Record<string, Entry[]> = {}

    if (savedMap) {
      try {
        const parsed = JSON.parse(savedMap) as Record<string, Entry[]>
        const sanitizedEntries: Record<string, Entry[]> = {}
        Object.keys(parsed).forEach(key => {
          sanitizedEntries[key] = sanitizeEntries(parsed[key])
        })
        initialMap = sanitizedEntries
      } catch (e) {
        console.error("Erro ao carregar entradas por usuário do localStorage", e)
      }
    } else if (savedLegacy) {
      try {
        const parsedLegacy: Entry[] = JSON.parse(savedLegacy)
        initialMap = { [FALLBACK_USER]: sanitizeEntries(parsedLegacy) }
      } catch (e) {
        console.error("Erro ao carregar entradas legadas do localStorage", e)
      }
    }

    setEntriesByUser(initialMap)

    const savedCurrentUser = localStorage.getItem("current-user")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const savedTheme = localStorage.getItem("theme")
    const startTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : prefersDark ? "dark" : "light"
    setTheme(startTheme)
    document.documentElement.classList.toggle("dark", startTheme === "dark")

    const initialUser = savedCurrentUser || (parsedUsers[0]?.name ?? "")
    const activeKey = initialUser || FALLBACK_USER
    const initialEntries = initialMap[activeKey] && initialMap[activeKey].length ? initialMap[activeKey] : defaultEntry()

    if (initialUser) {
      setSelectedUser(initialUser)
      setComboValue(initialUser)
    }
    setEntries(initialEntries)
  }, [])

  useEffect(() => {
    if (theme) {
      document.documentElement.classList.toggle("dark", theme === "dark")
      localStorage.setItem("theme", theme)
    }
  }, [theme])

  useEffect(() => {
    calculateTotal()
  }, [entries, user])

  useEffect(() => {
    localStorage.setItem("users", JSON.stringify(users))
  }, [users])

  useEffect(() => {
    localStorage.setItem("hour-entries-by-user", JSON.stringify(entriesByUser))
  }, [entriesByUser])

  useEffect(() => {
    if (selectedUser) {
      localStorage.setItem("current-user", selectedUser)
    } else {
      localStorage.removeItem("current-user")
    }
  }, [selectedUser])

  useEffect(() => {
    const activeKey = selectedUser || FALLBACK_USER
    setEntriesByUser(prev => ({
      ...prev,
      [activeKey]: entries
    }))
  }, [entries, selectedUser])

  useEffect(() => {
    if (!selectedUser) return
    const selected = users.find(u => u.name === selectedUser)
    if (selected) setUser(selected)
  }, [selectedUser, users])

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      const firstUser = users[0].name
      setSelectedUser(firstUser)
      setComboValue(firstUser)
      setEntries(entriesByUser[firstUser] && entriesByUser[firstUser].length ? entriesByUser[firstUser] : defaultEntry())
    }
  }, [selectedUser, users, entriesByUser])

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

  function splitRange(start: number, end: number) {
    return start <= end ? [[start, end]] : [[start, 1440], [0, end]]
  }

  function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    let totalOverlap = 0
    const aRanges = splitRange(aStart, aEnd)
    const bRanges = splitRange(bStart, bEnd)

    aRanges.forEach(([a1, a2]) => {
      bRanges.forEach(([b1, b2]) => {
        const overlap = Math.min(a2, b2) - Math.max(a1, b1)
        if (overlap > 0) totalOverlap += overlap
      })
    })

    return totalOverlap
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
          const workedInsideSchedule = overlapMinutes(startMin, endMin, workStartMin, workEndMin)
          const extraOutsideSchedule = Math.max(duration - workedInsideSchedule, 0)
          totalExtra += extraOutsideSchedule
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
    const pauseValue = Number(pause || "0")
    if (!Number.isFinite(pauseValue) || pauseValue < 0) {
      setWorked("00:00")
      return toast.error("Informe um valor válido para a pausa.")
    }
    const pauseMin = pauseType === "h" ? pauseValue * 60 : pauseValue
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
    const trimmedName = user.name.trim()
    const exists = users.find(u => u.name === trimmedName)
    if (exists) {
      setUsers(users.map(u => (u.name === trimmedName ? { ...user, name: trimmedName } : u)))
      setSelectedUser(trimmedName)
      setComboValue(trimmedName)
      toast.success("Funcionário atualizado!")
    } else {
      setUsers([...users, { ...user, name: trimmedName }])
      setEntriesByUser(prev => ({
        ...prev,
        [trimmedName]: prev[trimmedName] ?? defaultEntry()
      }))
      setEntries(defaultEntry())
      setSelectedUser(trimmedName)
      setComboValue(trimmedName)
      toast.success("Funcionário adicionado!")
    }
  }

  function confirmRemoveUserAction() {
    if (confirmRemoveUser !== null) {
      const remainingUsers = users.filter(u => u.name !== confirmRemoveUser)
      setUsers(remainingUsers)
      setEntriesByUser(prev => {
        const { [confirmRemoveUser]: removed, ...rest } = prev
        return rest
      })
      if (user.name === confirmRemoveUser) setUser({ name: "", workStart: "", workEnd: "" })
      if (comboValue === confirmRemoveUser) setComboValue("")
      if (selectedUser === confirmRemoveUser) {
        const fallback = remainingUsers[0]
        if (fallback) {
          setSelectedUser(fallback.name)
          setUser(fallback)
          setEntries(entriesByUser[fallback.name] ?? defaultEntry())
          setComboValue(fallback.name)
        } else {
          setSelectedUser("")
          setEntries(defaultEntry())
          setComboValue("")
        }
      }
      toast.warning(`Funcionário "${confirmRemoveUser}" removido.`)
      setConfirmRemoveUser(null)
    }
  }

  function selectUser(name: string) {
    const selected = users.find(u => u.name === name)
    if (selected) {
      setUser(selected)
      setSelectedUser(name)
      setEntries(entriesByUser[name] ?? defaultEntry())
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
              <AlertDialogDescription>Essa Ação não pode ser desfeita.</AlertDialogDescription>
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
              <AlertDialogTitle>Remover este Horário?</AlertDialogTitle>
              <AlertDialogDescription>Essa Ação não pode ser desfeita.</AlertDialogDescription>
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
              <AlertDialogTitle>Remover Funcionário &quot;{confirmRemoveUser}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>Essa Ação não pode ser desfeita.</AlertDialogDescription>
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
              <h1 className="text-2xl sm:text-3xl font-bold">Calculadora - Recursos Humanos</h1>
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
                      <span className="truncate max-w-[180px]">{comboValue || "Selecionar Funcionário"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar Funcionário..." />
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
                <Label htmlFor="user-name" className="p-2">Nome</Label>
                  <Input id="user-name" placeholder="Nome" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} />
                </div>
                <div>
                <Label htmlFor="timeStart" className="p-2">Início</Label>
                  <Input id="timeStart" type="time" value={user.workStart} onChange={(e) => setUser({ ...user, workStart: e.target.value })} />
                </div>
                <div>
                <Label htmlFor="timeEnd" className="p-2">Fim</Label>
                  <Input id="timeEnd" type="time" value={user.workEnd} onChange={(e) => setUser({ ...user, workEnd: e.target.value })} />
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








