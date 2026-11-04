import { useState } from 'react'
import { FABRIC_COLORS } from '../data/colors'

type Props = {
  tint: string | null
  hue: number
  saturation: number
  onTintChange: (tint: string | null) => void
  onHueChange: (hue: number) => void
  onSaturationChange: (saturation: number) => void
}

// สีผ้า: เลือกสีจริง (ย้อมทับลาย) หรือ "สีเดิมของลาย" + สีเอง + ปรับละเอียด
function ColorPicker({ tint, hue, saturation, onTintChange, onHueChange, onSaturationChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const selected = FABRIC_COLORS.find((c) => c.hex === tint)
  const label = tint === null ? 'สีเดิมของลาย' : (selected?.name ?? 'สีที่เลือกเอง')

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-muted">ตอนนี้: <span className="text-ink">{label}</span></span>

      <div className="grid grid-cols-7 gap-2.5">
        <button
          type="button"
          aria-label="สีเดิมของลาย"
          title="สีเดิมของลาย"
          onClick={() => onTintChange(null)}
          className={`aspect-square rounded-full border border-black/10 transition-transform hover:scale-110 ${
            tint === null ? 'ring-1 ring-ink ring-offset-2 ring-offset-ivory' : ''
          }`}
          style={{ background: 'conic-gradient(#c78f9a, #8fa7c7, #c7b98f, #9ac78f, #c78f9a)' }}
        />
        {FABRIC_COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            aria-label={color.name}
            title={color.name}
            onClick={() => onTintChange(color.hex)}
            className={`aspect-square rounded-full border border-black/10 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.18),inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform hover:scale-110 ${
              tint === color.hex ? 'ring-1 ring-ink ring-offset-2 ring-offset-ivory' : ''
            }`}
            style={{ backgroundColor: color.hex }}
          />
        ))}
        <label
          title="เลือกสีเอง"
          className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-full border border-ink/40 text-sm text-ink transition-transform hover:scale-110 ${
            tint && !selected ? 'ring-1 ring-ink ring-offset-2 ring-offset-ivory' : ''
          }`}
          style={tint && !selected ? { backgroundColor: tint} : undefined}
        >
          <span className={tint && !selected ? 'sr-only' : ''}>+</span>
          <input
            type="color"
            aria-label="เลือกสีเอง"
            value={tint ?? '#888888'}
            onChange={(e) => onTintChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      <button type="button" onClick={() => setAdvancedOpen((v) => !v)} className="btn btn-text self-start text-xs">
        ปรับโทนลายละเอียด {advancedOpen ? '−' : '+'}
      </button>

      {advancedOpen && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ink">
            <span>เฉดสี ({hue}°)</span>
            <input type="range" min={-180} max={180} value={hue} onChange={(e) => onHueChange(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink">
            <span>ความสด ({saturation}%)</span>
            <input
              type="range"
              min={0}
              max={200}
              value={saturation}
              onChange={(e) => onSaturationChange(Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default ColorPicker
