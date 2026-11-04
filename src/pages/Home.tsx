import { useRef } from 'react'
import { Link } from 'react-router-dom'
import FabricHero from '../components/FabricHero'
import LookCard from '../components/LookCard'
import type { MannequinItem } from '../components/MannequinLayers'
import { GalleryScene, PatternsScene, StudioScene, TryOnScene, useOutfitPreview } from '../components/MenuPreview'
import { garments } from '../data/garments'
import Tilt from '../components/Tilt'
import { gsap, useGSAP } from '../lib/gsap'
import { LOOKS } from '../data/looks'
import { patterns } from '../data/patterns'


const steps = [
  {
    no: '01',
    title: 'เลือกทรงชุด',
    description: 'เสื้อ 5 แบบ กางเกง/กระโปรง 5 แบบ และเครื่องประดับ ใส่บนหุ่น 3 มิติ',
    kind: 'garments' as const,
  },
  {
    no: '02',
    title: 'เลือกลาย สี และเนื้อผ้า',
    description: 'ลายผ้ากว่า 20 ลาย สีจริง 12 สี ผ้าด้าน ซาติน ยีนส์ ไหมพรม',
    kind: 'patterns' as const,
  },
  {
    no: '03',
    title: 'ลองสวมแล้วถ่ายรูปเก็บ',
    description: 'เปิดกล้อง ชุดขยับตามตัวแบบเรียลไทม์ กดถ่ายเก็บไว้ในแกลเลอรี',
    kind: 'tryon' as const,
  },
]


// ทรงชุดเติมลายผ้า (ใช้ mask ของทรงชุดเป็นหน้ากาก) — ภาพประกอบขั้นที่ 1
function GarmentCollage() {
  const shown = garments.filter((g) => g.slot !== 'accessory').slice(0, 9)
  return (
    <div className="absolute inset-0 grid grid-cols-3 gap-4 bg-stone p-7 pt-24">
      {shown.map((g, i) => (
        <span key={g.id} className="block h-full w-full drop-shadow-[0_10px_10px_rgba(0,0,0,0.25)] transition-transform duration-700 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 40}ms` }}>
          <span
            className="block h-full w-full"
            style={{
              WebkitMaskImage: `url("${g.maskSrc}")`,
              maskImage: `url("${g.maskSrc}")`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              backgroundImage: `url("${patterns[(i * 3 + 1) % patterns.length].src}")`,
              backgroundSize: '26px 26px',
            }}
          />
        </span>
      ))}
    </div>
  )
}

// จอจำลองหน้าสตูดิโอ (ย่อส่วน) ในแล็ปท็อปของส่วน Design
const SCREEN_PATTERNS = ['stripes', 'gingham', 'leopard', 'stars', 'argyle', 'herringbone', 'polka', 'paisley']
const SCREEN_COLORS = ['#1c1a19', '#efe9df', '#9a6a3a', '#6d1f2a', '#1f2e4a', '#9aa88a']

function StudioScreen({ items }: { items: MannequinItem[] }) {
  return (
    <div className="flex h-full w-full text-ink">
      <div className="relative w-[58%]">
        <StudioScene items={items} />
        <span className="absolute bottom-[5%] left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-white/80 px-2 py-1 text-[7px] shadow-sm">
          <span className="rounded-full px-1.5 py-0.5">ย้อนกลับ</span>
          <span className="rounded-full px-1.5 py-0.5">สุ่มลุค</span>
          <span className="rounded-full bg-ink px-1.5 py-0.5 text-white">เทียบ 3 สี</span>
        </span>
      </div>
      <div className="flex w-[42%] flex-col gap-[6%] bg-ivory p-[4%]">
        <span className="font-wordmark text-[15px] italic leading-none">Studio</span>
        <div className="flex flex-col gap-1">
          <span className="text-[7px] text-muted">02 ลายผ้า</span>
          <div className="grid grid-cols-4 gap-[3px]">
            {SCREEN_PATTERNS.map((id, i) => {
              const pat = patterns.find((p) => p.id === id)
              return (
                <span
                  key={id}
                  className={`aspect-square ${i === 0 ? 'ring-1 ring-ink ring-offset-1 ring-offset-ivory' : ''}`}
                  style={{ backgroundImage: pat ? `url("${pat.src}")` : undefined, backgroundSize: '14px 14px' }}
                />
              )
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[7px] text-muted">03 สีผ้า</span>
          <div className="flex gap-[4px]">
            {SCREEN_COLORS.map((c, i) => (
              <span key={c} className={`aspect-square w-[13%] rounded-full ${i === 4 ? 'ring-1 ring-ink ring-offset-1 ring-offset-ivory' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[7px] text-muted">04 เนื้อผ้า</span>
          <div className="grid grid-cols-4 gap-[3px] text-[6px]">
            {['ด้าน', 'ซาติน', 'ยีนส์', 'ไหมพรม'].map((f, i) => (
              <span key={f} className={`py-1 text-center ${i === 1 ? 'bg-ink text-white' : 'bg-white/70'}`}>
                {f}
              </span>
            ))}
          </div>
        </div>
        <span className="mt-auto rounded-full bg-ink py-1.5 text-center text-[7px] text-white">ลองสวมผ่านกล้อง →</span>
      </div>
    </div>
  )
}

function PanelCaption({ no, th, en, note, dark = false }: { no: string; th: string; en: string; note: string; dark?: boolean }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-10 ${dark ? 'text-white' : 'text-ink'}`}>
      <div className="flex flex-col gap-2">
        <span className={`text-[11px] uppercase tracking-[0.14em] ${dark ? 'text-white/60' : 'text-muted'}`}>
          {no} · {th}
        </span>
        <span className="font-wordmark text-6xl italic leading-none transition-transform duration-700 group-hover:translate-x-2 sm:text-7xl">
          {en}
        </span>
        <span className={`max-w-xs text-sm ${dark ? 'text-white/70' : 'text-muted'}`}>{note}</span>
      </div>
      <span
        aria-hidden
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 group-hover:scale-110 ${
          dark ? 'border-white/40 group-hover:bg-white group-hover:text-ink' : 'border-ink/30 group-hover:bg-ink group-hover:text-white'
        }`}
      >
        →
      </span>
    </div>
  )
}

// ลายเด่นในหน้าแรก (คละสไตล์) — ที่เหลือดูได้ในหน้าคลังลาย
const FEATURED_IDS = ['stripes', 'leopard', 'gingham', 'herringbone', 'checker', 'paisley', 'stars', 'argyle']
const FEATURED = FEATURED_IDS.map((id) => patterns.find((p) => p.id === id)).filter((p): p is (typeof patterns)[number] => !!p)

function Home() {
  const outfitItems = useOutfitPreview()
  const railRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.fromTo('.hero-photo', { scale: 1.08 }, { scale: 1, duration: 1.2 })
          .from(
            '.hero-wordmark .char',
            { yPercent: 110, duration: 0.8, stagger: 0.04 },
            0.1,
          )
          .from('.hero-heading', { y: 24, opacity: 0, duration: 0.7 }, 0.3)
          .from(
            '.hero-actions > *',
            { y: 12, opacity: 0, duration: 0.5, stagger: 0.08 },
            0.45,
          )
          .from('.hero-card', { y: -12, opacity: 0, duration: 0.6 }, 0.3)

        // กราฟิกทุก section: เปิดเผยจากล่างขึ้นบนตอนเลื่อนมาถึง (ข้อ 4.8)
        const reveals = gsap.utils.toArray<HTMLElement>('.js-reveal').map((el) =>
          gsap.fromTo(
            el,
            { clipPath: 'inset(0 0 100% 0)' },
            {
              clipPath: 'inset(0 0 0% 0)',
              duration: 0.9,
              ease: 'power3.out',
              scrollTrigger: { trigger: el, start: 'top 85%' },
            },
          ),
        )

        // หัวข้อ: จางขึ้น + เลื่อนขึ้น 24px ตอนเลื่อนมาถึง (ข้อ 11)
        const fades = gsap.utils.toArray<HTMLElement>('.js-fade').map((el) =>
          gsap.from(el, {
            y: 24,
            opacity: 0,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          }),
        )

        return () => {
          tl.kill()
          ;[...reveals, ...fades].forEach((tween) => {
            tween.scrollTrigger?.kill()
            tween.kill()
          })
        }
      })

      return () => mm.revert()
    },
    { scope: containerRef },
  )

  return (
    <div ref={containerRef} className="flex flex-1 flex-col">
      {/* 1. Hero 100vh — กราฟิกไอคอนชุดของเราเอง ซ้อนชั้นแทนรูปถ่าย */}
      <section className="relative -mt-14 h-dvh w-full overflow-hidden bg-night">
        {/* ผ้า 3 มิติพลิ้ว ใช้ลายจริงของเว็บ เอียงตามเมาส์ */}
        <div className="hero-photo absolute inset-0">
          <FabricHero className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

        <div className="hero-card absolute right-4 top-24 z-10 flex max-w-[200px] flex-col gap-1 bg-bg p-4 sm:right-8">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted">ใหม่</span>
          <span className="text-sm text-ink">เทียบ 3 สีในครั้งเดียว</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-6 px-6 pb-10 sm:px-10 sm:pb-14">
          <p
            aria-hidden
            className="hero-wordmark pointer-events-none select-none overflow-hidden whitespace-nowrap font-wordmark text-[15vw] italic leading-[0.9] text-white mix-blend-difference"
          >
            {'LONG LOOK'.split('').map((char, index) => (
              <span key={index} className="char inline-block">
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </p>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="hero-heading max-w-sm font-heading text-2xl leading-snug text-white">
              ออกแบบลุคของคุณเอง แล้วลองสวมได้ทันที
            </h1>

            <div className="hero-actions flex flex-wrap gap-2">
              <Link to="/studio" className="btn h-12 bg-white px-7 text-ink hover:opacity-85">
                เริ่มออกแบบ
              </Link>
              <Link
                to="/tryon"
                className="btn h-12 border border-white px-7 text-white hover:bg-white/10"
              >
                ลองสวมเลย
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. แบ่งครึ่ง 50/50 — หุ่น 3 มิติหมุนเอง / มือถือ 3 มิติจอลองสวม */}
      <style>{'@keyframes ll-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-10px,0)}}'}</style>
      <section className="grid md:grid-cols-2">
        {/* ซ้าย: Design — แล็ปท็อป 3 มิติ จอแสดงหน้าสตูดิโอ */}
        <Link
          to="/studio"
          className="group relative block h-[82vh] overflow-hidden md:h-[94vh]"
          style={{
            background: 'radial-gradient(ellipse 65% 55% at 50% 42%, #ffffff 0%, #f1ede7 50%, #d8cfc3 100%)',
            perspective: '1600px',
          }}
        >
          <p
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[8%] select-none text-center font-wordmark text-[22vw] italic leading-none text-ink/[0.05] md:text-[12vw]"
          >
            Studio
          </p>
          <div className="absolute inset-x-0 bottom-[34%] top-[10%] flex items-center justify-center [transform-style:preserve-3d] md:bottom-[22%] md:top-[12%]">
            <div
              className="relative w-[86%] max-w-[620px] transition-transform duration-[1.2s] ease-out [transform-style:preserve-3d] [transform:rotateY(16deg)_rotateX(8deg)_rotateZ(-2deg)] group-hover:[transform:rotateY(6deg)_rotateX(4deg)_rotateZ(0deg)]"
            >
              {/* จอ */}
              <div className="rounded-[14px] bg-[#1a1918] p-[7px] shadow-[0_50px_80px_-30px_rgba(0,0,0,0.55)] ring-1 ring-black/40">
                <div className="aspect-[16/10] overflow-hidden rounded-[8px] bg-white">
                  <StudioScreen items={outfitItems} />
                </div>
              </div>
              {/* ฐานแล็ปท็อป */}
              <div className="mx-auto h-[10px] w-[112%] -translate-x-[5.4%] rounded-b-[14px] bg-gradient-to-b from-[#d9d4cc] to-[#a9a39a] shadow-[0_30px_40px_-18px_rgba(0,0,0,0.5)]" />
              {/* ป้ายลอย (ลึกกว่าจอ) */}
              {[
                { t: '22 ลายผ้า', c: 'left-[2%] top-[-12%]', z: 90, d: 0 },
                { t: 'สีจริง 12 สี', c: 'right-[-10%] top-[22%]', z: 130, d: 1.1 },
                { t: 'หมุนดูหุ่น 360°', c: 'left-[-3%] bottom-[8%]', z: 110, d: 2 },
              ].map((chip) => (
                <span
                  key={chip.t}
                  className={`absolute hidden whitespace-nowrap rounded-full border border-white bg-white/75 px-4 py-2 text-xs text-ink shadow-[0_20px_40px_-18px_rgba(0,0,0,0.35)] backdrop-blur-md sm:block ${chip.c}`}
                  style={{ transform: `translateZ(${chip.z}px)` }}
                >
                  <span className="block motion-reduce:!animate-none" style={{ animation: `ll-float 6s ease-in-out ${chip.d}s infinite` }}>
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-ink align-middle" />
                    {chip.t}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <PanelCaption no="01" th="ออกแบบชุดบนหุ่น 3 มิติ" en="Design" note="เลือกทรง ลาย สี และเนื้อผ้า แล้วหมุนดูได้รอบตัว" />
        </Link>

        {/* ขวา: Try-On */}
        <Link to="/tryon" className="group relative block h-[82vh] overflow-hidden bg-night md:h-[94vh]" style={{ perspective: '1400px' }}>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 42%, rgba(255,255,255,0.12), transparent 70%)' }}
          />
          <p
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[8%] select-none text-center font-wordmark text-[22vw] italic leading-none text-white/[0.04] md:text-[12vw]"
          >
            Live
          </p>
          {/* มือถือลอยเอียง */}
          <div className="absolute inset-x-0 bottom-[32%] top-[6%] flex items-center justify-center [transform-style:preserve-3d] md:bottom-[16%] md:top-[7%]">
            <div
              className="relative aspect-[9/19] h-full max-h-[620px] rounded-[42px] border border-white/15 bg-[#0b0b0b] p-[10px] shadow-[0_60px_90px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)] transition-transform duration-[1.2s] ease-out [transform:rotateY(-16deg)_rotateX(6deg)_rotateZ(2deg)] group-hover:[transform:rotateY(-6deg)_rotateX(3deg)_rotateZ(0deg)]"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[33px]">
                <TryOnScene items={outfitItems} />
              </div>
              <span className="absolute left-1/2 top-[18px] h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-black" />
              {/* ป้ายลอยหน้าจอ (ลึกกว่ามือถือ) */}
              {[
                { t: 'จับท่าทาง 33 จุด', c: 'left-[-46%] top-[18%]', z: 90, d: 0 },
                { t: 'ชุดขยับตามตัวทันที', c: 'right-[-50%] top-[44%]', z: 120, d: 1.2 },
                { t: 'ภาพไม่ออกจากเครื่อง', c: 'left-[-42%] bottom-[16%]', z: 70, d: 2.1 },
              ].map((chip) => (
                <span
                  key={chip.t}
                  className={`absolute hidden whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md sm:block ${chip.c}`}
                  style={{ transform: `translateZ(${chip.z}px)` }}
                >
                  <span className="block motion-reduce:!animate-none" style={{ animation: `ll-float 6s ease-in-out ${chip.d}s infinite` }}>
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
                    {chip.t}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <PanelCaption dark no="02" th="ลองสวมผ่านกล้อง" en="Try-On" note="ระบบจับท่าทาง ชุดขยับตามตัวคุณแบบเรียลไทม์" />
        </Link>
      </section>

      {/* 3. Marquee ดำ */}
      <section className="overflow-hidden bg-night py-4">
        <div className="marquee-track flex w-max whitespace-nowrap">
          {[0, 1].map((rep) => (
            <span key={rep} className="flex items-center font-heading text-xl text-white">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="px-4">
                  ออกแบบเอง · ลองสวมทันที · ไม่ต้องตัดเย็บ · ประมวลผลในเครื่องคุณ ·
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* 4. 3 ขั้นตอน — การ์ดภาพจริงของแต่ละขั้น เอียง 3 มิติตามเมาส์ */}
      <section className="bg-ivory px-6 py-20 sm:px-10 sm:py-28">
        <div className="js-fade mb-12 flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">How it works</span>
          <h2 className="font-heading text-3xl text-ink sm:text-4xl">3 ขั้นตอนง่าย ๆ</h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-10">
          {steps.map((step, index) => (
            <Link key={step.no} to={step.kind === 'tryon' ? '/tryon' : '/studio'} className={`js-fade group block ${index === 1 ? 'md:mt-14' : ''}`}>
              <Tilt max={8} className="aspect-[4/5] overflow-hidden shadow-[0_30px_50px_-30px_rgba(0,0,0,0.45)]">
                {step.kind === 'garments' && <GarmentCollage />}
                {step.kind === 'patterns' && <PatternsScene />}
                {step.kind === 'tryon' && <GalleryScene items={outfitItems} />}
                <span className="pointer-events-none absolute left-5 top-3 z-10 font-wordmark text-7xl italic text-white mix-blend-difference">
                  {step.no}
                </span>
              </Tilt>
              <h3 className="mt-5 text-lg text-ink">{step.title}</h3>
              <p className="mt-1 max-w-xs text-sm text-muted">{step.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. คอลเลกชันลาย */}
      <section className="bg-bg py-16">
        <div className="js-fade flex flex-col gap-4 px-6 sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Fabric collection</span>
            <h2 className="font-heading text-3xl text-ink sm:text-4xl">คอลเลกชันลาย</h2>
            <p className="text-sm text-muted">ลายเด่น {FEATURED.length} ลายจากทั้งหมด {patterns.length} ลาย · ชี้ที่ผืนผ้าเพื่อดูแสงเงาแบบ 3 มิติ</p>
          </div>
          <div className="flex items-center gap-3">
            {[
              { label: 'เลื่อนไปทางซ้าย', dir: -1, icon: '←' },
              { label: 'เลื่อนไปทางขวา', dir: 1, icon: '→' },
            ].map((b) => (
              <button
                key={b.dir}
                type="button"
                aria-label={b.label}
                onClick={() => railRef.current?.scrollBy({ left: b.dir * (railRef.current.clientWidth * 0.7), behavior: 'smooth' })}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/25 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
              >
                {b.icon}
              </button>
            ))}
            <Link to="/patterns" className="btn btn-text ml-2 text-sm">
              ดูทั้งหมด {patterns.length} ลาย →
            </Link>
          </div>
        </div>

        <div
          ref={railRef}
          className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-6 pb-8 sm:gap-8 sm:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {FEATURED.map((pattern, index) => (
            <Link
              key={pattern.id}
              to="/studio"
              aria-label={`ใช้${pattern.name}ในสตูดิโอ`}
              className="group w-[72vw] shrink-0 snap-start sm:w-80 lg:w-[22rem]"
            >
              <Tilt className="aspect-[3/4] overflow-hidden bg-stone shadow-[0_24px_40px_-24px_rgba(0,0,0,0.45)]">
                {/* ผืนผ้า: ลายซ้ำ + ลายขยับเล็กน้อยตอนชี้ */}
                <span
                  className="absolute inset-0 transition-[background-position] duration-[1.2s] ease-out group-hover:[background-position:24px_16px]"
                  style={{
                    backgroundImage: `url("${pattern.src}")`,
                    backgroundSize: '120px 120px',
                  }}
                />
                {/* รอยพับผ้า: แถบมืด-สว่างสลับ ซ้อนแบบ soft-light */}
                <span
                  aria-hidden
                  className="absolute inset-0 mix-blend-overlay"
                  style={{
                    background:
                      'linear-gradient(100deg, rgba(0,0,0,.6) 0%, rgba(255,255,255,.45) 14%, rgba(0,0,0,.5) 30%, rgba(255,255,255,.35) 48%, rgba(0,0,0,.55) 66%, rgba(255,255,255,.4) 82%, rgba(0,0,0,.65) 100%)',
                  }}
                />
                {/* แสงตกจากด้านบน + ชายผ้ามืดลง */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/45"
                />
                {/* มุมผ้าพับ */}
                <span
                  aria-hidden
                  className="absolute right-0 top-0 h-10 w-10 bg-gradient-to-bl from-ivory via-ivory/90 to-black/30 [clip-path:polygon(100%_0,0_0,100%_100%)] shadow-md"
                />
                <span className="absolute left-5 top-4 font-wordmark text-4xl italic text-white mix-blend-difference">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
                  <span className="text-lg">{pattern.name}</span>
                  {pattern.style && (
                    <span className="text-[11px] uppercase tracking-[0.12em] text-white/75">
                      {pattern.style}
                    </span>
                  )}
                </span>
              </Tilt>
              <span className="mt-3 block text-xs text-muted transition-colors group-hover:text-ink">
                ลองใช้ในสตูดิโอ →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. ลุคสำเร็จรูป — หุ่นใส่ชุดจริง กดแล้วเปิดลุคนั้นในสตูดิโอ */}
      <section className="bg-ivory px-6 py-20 sm:px-10">
        <div className="js-fade mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Ready to wear</span>
            <h2 className="font-heading text-3xl text-ink sm:text-4xl">ลุคสำเร็จรูป</h2>
            <p className="max-w-md text-sm text-muted">เลือกลุคที่ชอบ แล้วไปแต่งต่อในสตูดิโอ เปลี่ยนทรง ลาย สี ได้ทุกชิ้น</p>
          </div>
          <Link to="/studio" className="btn btn-text self-start text-sm sm:self-auto">
            ออกแบบเองตั้งแต่ต้น →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {LOOKS.map((look, index) => (
            <div key={look.id} className={`js-fade ${index % 2 === 1 ? 'lg:mt-16' : ''}`}>
              <LookCard look={look} index={index} />
            </div>
          ))}
        </div>
      </section>

      {/* 7. Section ดำ */}
      <section className="flex flex-col items-center gap-10 bg-night px-6 py-20 text-center sm:flex-row sm:px-16 sm:text-left">
        <div className="js-fade flex flex-1 flex-col gap-4 sm:max-w-sm">
          <h2 className="font-heading text-3xl text-white">AR ทำงานในเครื่องคุณ</h2>
          <p className="text-sm text-white/60">
            ภาพจากกล้องประมวลผลในเครื่องคุณเท่านั้น ไม่ถูกส่งออกไปไหน — เปิดกล้องแล้วเห็นชุดสวมบนตัวได้ทันที
          </p>
          <Link to="/tryon" className="btn btn-primary mt-2 self-center bg-white text-ink sm:self-start">
            ลองสวมเลย
          </Link>
        </div>

        <div className="js-fade flex flex-1 items-center justify-center">
          <Tilt max={14} className="rounded-[32px]">
          <div className="relative h-[420px] w-[210px] rotate-3 rounded-[32px] border border-white/15 bg-black shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
            <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="absolute inset-3 top-8 flex flex-col items-center justify-end gap-3 overflow-hidden rounded-[24px] bg-gradient-to-b from-white/5 to-white/0">
              <span className="h-16 w-16 rounded-full border border-white/25" />
              <span className="mb-6 h-14 w-14 rounded-full border-2 border-white" />
            </div>
          </div>
          </Tilt>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="overflow-hidden bg-bg pt-14">
        <div className="flex flex-col gap-4 px-6 pb-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-10">
          <Link to="/" className="hover:text-ink">
            หน้าแรก
          </Link>
          <Link to="/studio" className="hover:text-ink">
            สตูดิโอ
          </Link>
          <Link to="/tryon" className="hover:text-ink">
            ลองสวม
          </Link>
          <Link to="/patterns" className="hover:text-ink">
            คลังลาย
          </Link>
          <Link to="/gallery" className="hover:text-ink">
            แกลเลอรี
          </Link>
        </div>
        <p
          aria-hidden
          className="-mb-[3vw] select-none whitespace-nowrap px-6 font-wordmark text-[16vw] italic leading-none text-ink sm:px-10"
        >
          LONG LOOK
        </p>
      </footer>
    </div>
  )
}

export default Home
