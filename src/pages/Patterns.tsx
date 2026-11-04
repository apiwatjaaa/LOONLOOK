import { patterns } from '../data/patterns'

function Patterns() {
  return (
    <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="text-center">
        <h1 className="font-heading text-3xl text-ink">คลังลายผ้า</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          ลายผ้าที่เลือกใช้ออกแบบชุดได้ในสตูดิโอ
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {patterns.map((pattern) => (
          <div key={pattern.id} className="flex flex-col gap-2">
            <div
              className="aspect-square w-full rounded-[4px] bg-surface"
              style={{
                backgroundImage: `url("${pattern.src}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              aria-hidden
            />
            <div>
              <h2 className="text-sm text-ink">{pattern.name}</h2>
              {pattern.style && (
                <p className="mt-0.5 text-xs uppercase tracking-[0.08em] text-muted">
                  {pattern.style}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Patterns
