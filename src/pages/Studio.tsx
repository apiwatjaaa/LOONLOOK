import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ColorPicker from '../components/ColorPicker'
import GarmentIcon from '../components/GarmentIcon'
import GarmentPicker from '../components/GarmentPicker'
import type { MannequinItem } from '../components/MannequinLayers'
import PatternCanvas from '../components/PatternCanvas'
import PatternPicker from '../components/PatternPicker'
import Stage, { type CompareVariant } from '../components/Stage'
import type { Piece } from '../three/mannequinScene'
import { FABRIC_COLORS } from '../data/colors'
import type { Garment, GarmentSlot } from '../data/garments'
import { garments } from '../data/garments'
import { LOOKS, type Look } from '../data/looks'
import type { Pattern } from '../data/patterns'
import { findPattern, patterns, SOLID_PATTERN } from '../data/patterns'
import { composeGarment, type ComposeOptions } from '../design/composeGarment'
import { readSavedOutfits, saveOutfit } from '../lib/savedOutfits'
import type { Finish, SlotConfig } from '../store/useOutfit'
import { useOutfitStore } from '../store/useOutfit'

type Outfit = Partial<Record<GarmentSlot, SlotConfig>>

const SLOT_LABELS: Record<GarmentSlot, string> = {
  top: 'ท่อนบน',
  bottom: 'ท่อนล่าง',
  full: 'ชิ้นเต็มตัว',
  accessory: 'เครื่องประดับ',
}

const STUDIO_SLOTS = Array.from(new Set(garments.map((g) => g.slot)))

const FINISHES: { id: Finish; name: string; note: string }[] = [
  { id: 'matte', name: 'ผ้าด้าน', note: 'เรียบ นุ่ม' },
  { id: 'satin', name: 'ซาติน', note: 'มันวาว' },
  { id: 'denim', name: 'ยีนส์', note: 'เส้นทอเฉียง' },
  { id: 'knit', name: 'ไหมพรม', note: 'ลายถัก' },
]

const ROTATIONS = [0, 45, 90, 135]

function garmentsOfSlot(slot: GarmentSlot): Garment[] {
  return garments.filter((g) => g.slot === slot)
}

function randomItem<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

// ลุคเริ่มต้น: เสื้อยืดลายทาง + กระโปรงผ้าพื้นกรมท่า (เครื่องประดับปิดไว้ก่อน)
const DEFAULT_LOOK: Partial<Record<GarmentSlot, Partial<SlotConfig>>> = {
  top: { patternId: 'stripes', tint: null, finish: 'knit' },
  bottom: { patternId: 'solid', tint: '#1f2e4a', finish: 'satin' },
  accessory: { patternId: 'leopard', enabled: false },
}

function defaultSlotConfig(slot: GarmentSlot): SlotConfig {
  return {
    garmentId: garmentsOfSlot(slot)[0]?.id ?? '',
    patternId: patterns[0].id,
    hue: 0,
    saturation: 100,
    scale: 1,
    tint: null,
    rotation: 0,
    finish: 'matte',
    enabled: true,
    ...DEFAULT_LOOK[slot],
  }
}

function randomSlotConfig(slot: GarmentSlot): SlotConfig {
  const solid = Math.random() < 0.35
  return {
    garmentId: randomItem(garmentsOfSlot(slot)).id,
    patternId: solid ? SOLID_PATTERN.id : randomItem(patterns).id,
    hue: 0,
    saturation: 100,
    scale: Math.round((0.7 + Math.random() * 0.8) * 10) / 10,
    tint: solid || Math.random() < 0.5 ? randomItem(FABRIC_COLORS).hex : null,
    rotation: randomItem(ROTATIONS),
    finish: randomItem(FINISHES).id,
    enabled: slot !== 'accessory' || Math.random() < 0.7,
  }
}

function buildOutfit(make: (slot: GarmentSlot) => SlotConfig): Outfit {
  const outfit: Outfit = {}
  for (const slot of STUDIO_SLOTS) outfit[slot] = make(slot)
  return outfit
}

function composeOptions(config: SlotConfig): ComposeOptions {
  return {
    hue: config.hue,
    saturation: config.saturation,
    scale: config.scale,
    tint: config.tint ?? null,
    rotation: config.rotation ?? 0,
    finish: config.finish ?? 'matte',
  }
}

function Section({ no, title, children, aside }: { no: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-3 text-sm text-ink">
          <span className="font-wordmark text-lg italic text-muted">{no}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Studio() {
  const [outfit, setOutfit] = useState<Outfit>(() => buildOutfit(defaultSlotConfig))
  const historyRef = useRef<Outfit[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [customPatterns, setCustomPatterns] = useState<Partial<Record<GarmentSlot, Pattern>>>({})
  const [previewBitmaps, setPreviewBitmaps] = useState<Partial<Record<GarmentSlot, ImageBitmap | null>>>({})
  const [savedCount, setSavedCount] = useState(0)
  const [message, setMessage] = useState('')
  const [drawingSlot, setDrawingSlot] = useState<GarmentSlot | null>(null)
  const [activeSlot, setActiveSlot] = useState<GarmentSlot>(STUDIO_SLOTS[0])
  const [presetName, setPresetName] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareVariants, setCompareVariants] = useState<CompareVariant[]>([])
  const setStoreOutfit = useOutfitStore((s) => s.setOutfit)

  // เปลี่ยนชุดทุกครั้งผ่านฟังก์ชันนี้ → เก็บประวัติไว้กด "ย้อนกลับ" ได้
  function commit(next: Outfit | ((prev: Outfit) => Outfit)) {
    const value = typeof next === 'function' ? next(outfit) : next
    historyRef.current = [...historyRef.current.slice(-29), outfit]
    setCanUndo(true)
    setOutfit(value)
    setMessage('')
  }

  function undo() {
    const prev = historyRef.current.pop()
    if (!prev) return
    setOutfit(prev)
    setCanUndo(historyRef.current.length > 0)
  }

  function applyLook(look: Look) {
    const next = buildOutfit(defaultSlotConfig)
    for (const slot of STUDIO_SLOTS) {
      const p = look.outfit[slot]
      if (p) next[slot] = { ...defaultSlotConfig(slot), ...p }
    }
    commit(next)
    setPresetName(look.name)
  }

  // มาจากหน้าแรก /studio?look=<id> → ใส่ลุคนั้นให้เลย
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const look = LOOKS.find((l) => l.id === searchParams.get('look'))
    if (look) applyLook(look)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ส่งเฉพาะชิ้นที่เปิดใส่ไปให้หน้า Try-On
  useEffect(() => {
    const worn: Outfit = {}
    for (const slot of STUDIO_SLOTS) {
      const config = outfit[slot]
      if (config && config.enabled !== false) worn[slot] = config
    }
    setStoreOutfit(worn, customPatterns)
  }, [outfit, customPatterns, setStoreOutfit])

  useEffect(() => {
    setSavedCount(readSavedOutfits().length)
  }, [])

  function patternsForSlot(slot: GarmentSlot): Pattern[] {
    const custom = customPatterns[slot]
    return [SOLID_PATTERN, ...patterns, ...(custom ? [custom] : [])]
  }

  function resolvePattern(slot: GarmentSlot, id: string): Pattern {
    return patternsForSlot(slot).find((p) => p.id === id) ?? findPattern(id)
  }

  function updateSlot(slot: GarmentSlot, patch: Partial<SlotConfig>) {
    commit((prev) => ({ ...prev, [slot]: { ...(prev[slot] ?? defaultSlotConfig(slot)), ...patch } }))
    setPresetName(null)
  }

  function applyCustomPattern(slot: GarmentSlot, src: string, name: string, description: string) {
    const customPattern: Pattern = { id: `custom-${slot}`, name, description, src }
    setCustomPatterns((prev) => ({ ...prev, [slot]: customPattern }))
    updateSlot(slot, { patternId: customPattern.id })
  }

  function handleUpload(slot: GarmentSlot, file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') applyCustomPattern(slot, reader.result, 'ลายของคุณ', 'ลายผ้าที่อัปโหลดเอง')
    }
    reader.readAsDataURL(file)
  }

  // รวมทรง + ลาย + สี + เนื้อผ้า ใหม่ทุกครั้งที่ตั้งค่าเปลี่ยน
  useEffect(() => {
    let cancelled = false
    for (const slot of STUDIO_SLOTS) {
      const config = outfit[slot]
      if (!config) continue
      const garment = garments.find((g) => g.id === config.garmentId)
      if (!garment) continue
      const pattern = resolvePattern(slot, config.patternId)
      composeGarment(garment.maskSrc, pattern.src, garment.shadingSrc, composeOptions(config))
        .then((bitmap) => {
          if (!cancelled) setPreviewBitmaps((prev) => ({ ...prev, [slot]: bitmap }))
        })
        .catch((err: unknown) => console.error(err))
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit, customPatterns])

  // เทียบ 3 สี: สีปัจจุบัน + อีก 2 สี ของชิ้นที่กำลังแก้
  useEffect(() => {
    if (!compareOpen) return
    let cancelled = false
    const active = outfit[activeSlot]
    if (!active) return
    const others = FABRIC_COLORS.filter((c) => c.hex !== active.tint)
    const pick = [others[(others.length / 3) | 0], others[((others.length * 2) / 3) | 0]]
    const options = [
      { name: 'สีปัจจุบัน', tint: active.tint ?? null },
      ...pick.map((c) => ({ name: c.name, tint: c.hex as string | null })),
    ]

    Promise.all(
      options.map(async (option) => {
        const items: MannequinItem[] = []
        const pieces: Piece[] = []
        for (const slot of STUDIO_SLOTS) {
          const config = outfit[slot]
          if (!config || config.enabled === false) continue
          const garment = garments.find((g) => g.id === config.garmentId)
          if (!garment) continue
          pieces.push({
            slot,
            garmentId: config.garmentId,
            patternSrc: resolvePattern(slot, config.patternId).src,
            config: slot === activeSlot ? { ...config, tint: option.tint } : config,
          })
          const opts = composeOptions(config)
          if (slot === activeSlot) opts.tint = option.tint
          const bitmap = await composeGarment(
            garment.maskSrc,
            resolvePattern(slot, config.patternId).src,
            garment.shadingSrc,
            opts,
          ).catch(() => null)
          items.push({ slot, bitmap, garmentId: garment.id })
        }
        return { ...option, items, pieces }
      }),
    ).then((variants) => {
      if (!cancelled) setCompareVariants(variants)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareOpen, activeSlot, outfit, customPatterns])

  function handleSave() {
    try {
      const list = saveOutfit(outfit)
      setSavedCount(list.length)
      setMessage(`บันทึกแล้ว · มีทั้งหมด ${list.length} ชุด`)
    } catch (err) {
      console.error(err)
      setMessage('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  const previewItems: MannequinItem[] = useMemo(
    () =>
      STUDIO_SLOTS.filter((slot) => outfit[slot]?.enabled !== false).map((slot) => ({
        slot,
        bitmap: previewBitmaps[slot] ?? null,
        garmentId: outfit[slot]?.garmentId,
      })),
    [outfit, previewBitmaps],
  )

  // ชิ้นที่ใส่อยู่ → ส่งให้หุ่น 3 มิติ (ลายผ้า/สี/เนื้อผ้าทำใน shader)
  const pieces3d: Piece[] = STUDIO_SLOTS.flatMap((slot) => {
    const config = outfit[slot]
    if (!config || config.enabled === false) return []
    return [{ slot, garmentId: config.garmentId, patternSrc: resolvePattern(slot, config.patternId).src, config }]
  })

  const active = outfit[activeSlot] ?? defaultSlotConfig(activeSlot)
  const activeGarment = garments.find((g) => g.id === active.garmentId)
  const activePattern = resolvePattern(activeSlot, active.patternId)
  const lookLabel = presetName ? `Look · ${presetName}` : 'Look · ของคุณ'

  return (
    <section className="mx-auto grid w-full max-w-[1400px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:gap-8">
      {/* เวที 3 มิติ */}
      <div className="lg:sticky lg:top-20 lg:col-span-7 lg:h-fit">
        <Stage
          items={previewItems}
          pieces={pieces3d}
          lookLabel={lookLabel}
          canUndo={canUndo}
          onUndo={undo}
          onReset={() => {
            commit(buildOutfit(defaultSlotConfig))
            setCustomPatterns({})
            setPresetName(null)
          }}
          onRandomize={() => {
            commit(buildOutfit(randomSlotConfig))
            setPresetName('สุ่ม')
          }}
          compareOpen={compareOpen}
          onToggleCompare={() => setCompareOpen((v) => !v)}
          compareVariants={compareVariants}
          onApplyCompare={(tint) => {
            updateSlot(activeSlot, { tint })
            setCompareOpen(false)
          }}
        />
      </div>

      {/* แผงออกแบบ */}
      <div className="flex flex-col gap-5 bg-ivory p-5 sm:p-7 lg:col-span-5">
        <header className="flex flex-col gap-1">
          <h1 className="font-wordmark text-4xl italic text-ink">Studio</h1>
          <p className="text-sm text-muted">เลือกชิ้น → ทรง → ลาย → สี → เนื้อผ้า แล้วดูบนหุ่นได้ทันที</p>
        </header>

        {/* ลุคสำเร็จรูป */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted">เริ่มจากลุคสำเร็จรูป</span>
          <div className="flex flex-wrap gap-2">
            {LOOKS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyLook(preset)}
                className={`h-9 rounded-full border px-4 text-xs transition-colors ${
                  presetName === preset.name
                    ? 'border-ink bg-ink text-white'
                    : 'border-ink/25 text-ink hover:border-ink'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* เลือกชิ้นที่จะแก้ */}
        <div className="grid grid-cols-3 gap-2">
          {STUDIO_SLOTS.map((slot) => {
            const config = outfit[slot]
            const worn = config?.enabled !== false
            const g = garments.find((x) => x.id === config?.garmentId)
            const isActive = activeSlot === slot
            return (
              <div
                key={slot}
                className={`relative flex flex-col gap-1 p-3 transition-all ${
                  isActive ? 'bg-white shadow-[0_12px_28px_-16px_rgba(0,0,0,0.35)]' : 'bg-white/45 hover:bg-white/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSlot(slot)
                    setCompareOpen(false)
                  }}
                  className="flex flex-col items-start gap-1 text-left"
                >
                  <GarmentIcon slot={slot} className={`h-5 w-5 ${isActive ? 'text-ink' : 'text-muted'}`} />
                  <span className={`text-sm ${isActive ? 'text-ink' : 'text-muted'}`}>{SLOT_LABELS[slot]}</span>
                  <span className="truncate text-[11px] text-muted">{worn ? g?.name : 'ไม่ใส่'}</span>
                </button>
                {slot === 'accessory' && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={worn}
                    aria-label="ใส่เครื่องประดับ"
                    onClick={() => updateSlot(slot, { enabled: !worn })}
                    className={`absolute right-2 top-2 h-4 w-7 rounded-full transition-colors ${worn ? 'bg-ink' : 'bg-ink/20'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${worn ? 'left-3.5' : 'left-0.5'}`}
                    />
                  </button>
                )}
                {isActive && <span className="absolute inset-x-3 bottom-0 h-px bg-ink" />}
              </div>
            )
          })}
        </div>

        {active.enabled === false ? (
          <div className="flex flex-col items-start gap-3 border-t border-line pt-5 text-sm text-muted">
            ตอนนี้ไม่ได้ใส่{SLOT_LABELS[activeSlot]}
            <button type="button" onClick={() => updateSlot(activeSlot, { enabled: true })} className="btn btn-secondary h-10 px-5 text-sm">
              ใส่{SLOT_LABELS[activeSlot]}
            </button>
          </div>
        ) : (
          <>
            <Section no="01" title="ทรง" aside={<span className="text-xs text-muted">{activeGarment?.name}</span>}>
              <GarmentPicker
                options={garmentsOfSlot(activeSlot)}
                selectedId={active.garmentId}
                onSelect={(id) => updateSlot(activeSlot, { garmentId: id })}
              />
            </Section>

            <Section no="02" title="ลายผ้า" aside={<span className="text-xs text-muted">{activePattern.name}</span>}>
              <PatternPicker
                options={patternsForSlot(activeSlot)}
                selectedId={active.patternId}
                onSelect={(id) => updateSlot(activeSlot, { patternId: id })}
              />
              <div className="flex flex-wrap gap-2">
                <label className="btn btn-secondary h-9 cursor-pointer px-4 text-xs">
                  อัปโหลดลายเอง
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(activeSlot, file)
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setDrawingSlot(drawingSlot === activeSlot ? null : activeSlot)}
                  className={`btn h-9 px-4 text-xs ${drawingSlot === activeSlot ? 'btn-primary' : 'btn-secondary'}`}
                >
                  วาดลายเอง
                </button>
              </div>
              {drawingSlot === activeSlot && (
                <PatternCanvas
                  onSave={(dataUrl) => {
                    applyCustomPattern(activeSlot, dataUrl, 'ลายที่วาดเอง', 'ลายผ้าที่วาดเองในสตูดิโอ')
                    setDrawingSlot(null)
                  }}
                  onCancel={() => setDrawingSlot(null)}
                />
              )}
            </Section>

            <Section no="03" title="สีผ้า">
              <ColorPicker
                tint={active.tint ?? null}
                hue={active.hue}
                saturation={active.saturation}
                onTintChange={(tint) => updateSlot(activeSlot, { tint })}
                onHueChange={(hue) => updateSlot(activeSlot, { hue })}
                onSaturationChange={(saturation) => updateSlot(activeSlot, { saturation })}
              />
            </Section>

            <Section no="04" title="เนื้อผ้า">
              <div className="grid grid-cols-4 gap-2">
                {FINISHES.map((f) => {
                  const on = (active.finish ?? 'matte') === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => updateSlot(activeSlot, { finish: f.id })}
                      className={`flex flex-col items-start gap-0.5 p-2.5 text-left transition-all ${
                        on ? 'bg-ink text-white' : 'bg-white/60 text-ink hover:bg-white'
                      }`}
                    >
                      <span className="text-xs">{f.name}</span>
                      <span className={`text-[10px] ${on ? 'text-white/70' : 'text-muted'}`}>{f.note}</span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section no="05" title="จัดวางลาย">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-ink">
                  <span>ขนาดลาย ({active.scale.toFixed(1)}x)</span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.5}
                    step={0.1}
                    value={active.scale}
                    onChange={(e) => updateSlot(activeSlot, { scale: Number(e.target.value) })}
                  />
                </label>
                <div className="flex flex-col gap-1 text-xs text-ink">
                  <span>หมุนลาย</span>
                  <div className="flex gap-1">
                    {ROTATIONS.map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => updateSlot(activeSlot, { rotation: deg })}
                        className={`h-8 flex-1 text-[11px] transition-colors ${
                          (active.rotation ?? 0) === deg ? 'bg-ink text-white' : 'bg-white/60 text-ink hover:bg-white'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ปุ่มล่าง ติดขอบล่างตอนเลื่อน */}
        <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-line bg-ivory/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
          {message && (
            <p className="text-xs text-muted" role="status">
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} className="btn btn-secondary h-12 flex-1 text-sm">
              บันทึกชุด{savedCount ? ` (${savedCount})` : ''}
            </button>
            <Link to="/tryon" className="btn btn-primary h-12 flex-[2] text-sm">
              ลองสวมผ่านกล้อง →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Studio
