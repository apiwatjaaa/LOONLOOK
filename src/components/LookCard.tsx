import { Link } from 'react-router-dom'
import type { Look } from '../data/looks'
import { useComposedOutfit } from '../lib/useComposedOutfit'
import MannequinLayers from './MannequinLayers'
import Tilt from './Tilt'

/**
 * การ์ดลุคสำเร็จรูป: หุ่นใส่ชุดจริงบนเวทีแสงสตูดิโอ
 * ชั้นลึก → ชั้นหน้า: เลขยักษ์ / แสง / หุ่น / เงาพื้น / ป้ายชื่อ  และเอียง 3 มิติตามเมาส์
 */
function LookCard({ look, index }: { look: Look; index: number }) {
  const items = useComposedOutfit(look.outfit)
  const no = String(index + 1).padStart(2, '0')

  return (
    <Link to={`/studio?look=${look.id}`} aria-label={`ลองลุค${look.name}ในสตูดิโอ`} className="group block">
      <Tilt
        max={9}
        className="aspect-[3/4] overflow-hidden shadow-[0_30px_50px_-30px_rgba(0,0,0,0.45)] transition-shadow duration-500 group-hover:shadow-[0_40px_70px_-30px_rgba(0,0,0,0.55)]"
      >
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 28%, #ffffff 0%, #f1ede7 45%, #d6cec3 100%)' }}
        />
        {/* เลขลุคตัวยักษ์ด้านหลัง */}
        <span
          aria-hidden
          className="absolute -right-2 top-2 font-wordmark text-[7.5rem] italic leading-none text-ink/[0.07] transition-transform duration-700 group-hover:-translate-x-2 lg:text-[9rem]"
        >
          {no}
        </span>
        {/* พื้นเวที */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-b from-transparent to-black/[0.06]" />

        {/* หุ่น: ยกขึ้นนิด ๆ ตอนชี้ */}
        <div className="absolute inset-x-0 bottom-[12%] top-[7%] transition-transform duration-700 ease-out group-hover:-translate-y-2">
          <MannequinLayers items={items} />
        </div>
        <span
          aria-hidden
          className="absolute bottom-[10%] left-1/2 h-4 w-1/2 -translate-x-1/2 rounded-full transition-all duration-700 group-hover:w-[42%] group-hover:opacity-70"
          style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.32), transparent 70%)' }}
        />

        <span className="absolute left-4 top-4 text-[11px] uppercase tracking-[0.14em] text-muted">Look {no}</span>
      </Tilt>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-wordmark text-2xl italic leading-none text-ink">{look.name}</span>
          <span className="text-xs text-muted">{look.tag}</span>
        </div>
        <span className="mt-1 shrink-0 text-xs text-ink underline decoration-1 underline-offset-4 opacity-60 transition-opacity group-hover:opacity-100">
          ลองลุคนี้ →
        </span>
      </div>
    </Link>
  )
}

export default LookCard
