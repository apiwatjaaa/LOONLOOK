import { useEffect, useRef } from 'react'
import { patterns } from '../data/patterns'

/**
 * ผ้า 3 มิติพลิ้วไหวใน hero (WebGL ล้วน ไม่ต้องลง library เพิ่ม)
 * - ระนาบตาราง 140x90 จุด ดันขึ้นลงด้วยคลื่น sin หลายชั้น = รอยพับของผ้า
 * - คำนวณ normal ทุกจุด แล้วจัดแสงแบบผ้าไหม: แสงหลัก + ไฮไลต์มันวาว + ขอบสว่าง
 * - ผิวผ้าใช้ลายจาก data/patterns สลับลายทุก ๆ 4.5 วินาทีแบบค่อย ๆ จาง
 * - เอียงตามเมาส์เล็กน้อย, หยุดวาดเมื่อเลื่อนพ้นจอ, รองรับ prefers-reduced-motion
 */

const VERT = `
attribute vec2 aUv;
uniform float uTime;
uniform float uAspect;
uniform vec2 uTilt;
uniform vec2 uSize;
uniform vec3 uOffset;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
varying float vH;

// ความสูงของผ้าที่ตำแหน่ง uv — ผสมคลื่นหลายความถี่ให้เหมือนรอยพับจริง
float height(vec2 uv, float t) {
  float x = uv.x * 6.2831;
  float y = uv.y * 6.2831;
  float w = 0.0;
  w += sin(x * 0.85 + y * 0.35 + t * 0.9) * 0.26;
  w += sin(x * 1.65 - y * 0.75 - t * 1.25) * 0.12;
  w += sin(y * 1.30 + x * 0.40 + t * 0.70) * 0.14;
  w += sin((x + y) * 2.60 + t * 1.60) * 0.025;
  // ขอบบนเหมือนถูกหนีบไว้ ขยับน้อยกว่าชายผ้าด้านล่าง
  float pin = mix(1.0, 0.35, uv.y);
  return w * pin;
}

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
  float h = height(aUv, uTime);
  float e = 0.004;
  float hx = height(aUv + vec2(e, 0.0), uTime);
  float hy = height(aUv + vec2(0.0, e), uTime);
  vec3 n = normalize(vec3(-(hx - h) / (e * uSize.x), -(hy - h) / (e * uSize.y), 1.0));

  vec3 p = vec3((aUv.x - 0.5) * uSize.x, (aUv.y - 0.5) * uSize.y, h);
  // ผ้าวางเฉียงนิด ๆ + เอียงตามเมาส์
  mat3 r = rotX(-0.35 + uTilt.y) * rotY(-0.25 + uTilt.x) * rotZ(0.12);
  p = r * p;
  n = r * n;
  p += uOffset;

  vUv = aUv;
  vNormal = n;
  vPos = p;
  vH = h;

  float f = 2.4;
  float near = 0.1;
  float far = 20.0;
  gl_Position = vec4(
    p.x * f / uAspect,
    p.y * f,
    (p.z * (far + near) + 2.0 * far * near) / (near - far),
    -p.z
  );
}
`

const FRAG = `
precision mediump float;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMix;
uniform vec2 uRepeat;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
varying float vH;

void main() {
  vec2 tuv = fract(vUv * uRepeat);
  vec3 base = mix(texture2D(uTexA, tuv).rgb, texture2D(uTexB, tuv).rgb, uMix);

  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(-vPos);
  vec3 l = normalize(vec3(-0.5, 0.8, 0.6));

  float diff = max(dot(n, l), 0.0);
  // ไฮไลต์มันวาวแบบผ้าไหม
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  // ขอบผ้าที่หันออกจากกล้องจะสว่างขึ้นนิด ๆ
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  // ร่องผ้ามืดลง
  float ao = 0.62 + 0.38 * smoothstep(-0.3, 0.3, vH);

  vec3 col = base * (0.28 + 0.82 * diff) * ao;
  col += vec3(1.0, 0.97, 0.92) * spec * 0.45;
  col += vec3(1.0) * rim * 0.08;
  gl_FragColor = vec4(col, 1.0);
}
`

const GRID_X = 140
const GRID_Y = 90
const PLANE_W = 3.2
const PLANE_H = 2.1
const SWITCH_MS = 4500
const FADE_MS = 1200

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[FabricHero] shader error', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

// วาดลาย (SVG/รูป) ลง canvas 512x512 ก่อน แล้วค่อยส่งเข้า WebGL
function loadPatternCanvas(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 512
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(img, 0, 0, 512, 512)
      resolve(c)
    }
    img.onerror = reject
    img.src = src
  })
}

// offset = ตำแหน่งผ้าในฉาก (x, y, ระยะลึก) — hero ใช้ค่าเริ่มต้น, การ์ดเล็กใช้ผ้าตรงกลาง
type Props = { className?: string; offset?: [number, number, number] }

function FabricHero({ className, offset = [0.6, 0.15, -4.1] }: Props) {
  const [ox, oy, oz] = offset
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false })
    if (!gl) return // เครื่องไม่รองรับ WebGL → ปล่อยพื้นหลังเดิมไว้

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[FabricHero] link error', gl.getProgramInfoLog(program))
      return
    }
    gl.useProgram(program)

    // ตาราง uv + index สามเหลี่ยม
    const uvs = new Float32Array((GRID_X + 1) * (GRID_Y + 1) * 2)
    let k = 0
    for (let j = 0; j <= GRID_Y; j++) {
      for (let i = 0; i <= GRID_X; i++) {
        uvs[k++] = i / GRID_X
        uvs[k++] = j / GRID_Y
      }
    }
    const idx = new Uint16Array(GRID_X * GRID_Y * 6)
    k = 0
    for (let j = 0; j < GRID_Y; j++) {
      for (let i = 0; i < GRID_X; i++) {
        const a = j * (GRID_X + 1) + i
        const b = a + 1
        const c = a + GRID_X + 1
        const d = c + 1
        idx.set([a, b, c, b, d, c], k)
        k += 6
      }
    }
    const uvBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
    const aUv = gl.getAttribLocation(program, 'aUv')
    gl.enableVertexAttribArray(aUv)
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)
    const idxBuf = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)

    const u = (name: string) => gl.getUniformLocation(program, name)
    const uTime = u('uTime')
    const uAspect = u('uAspect')
    const uTilt = u('uTilt')
    const uMix = u('uMix')
    gl.uniform3f(u('uOffset'), ox, oy, oz)
    gl.uniform2f(u('uSize'), PLANE_W, PLANE_H)
    gl.uniform2f(u('uRepeat'), 6.0, (6.0 * PLANE_H) / PLANE_W)
    gl.uniform1i(u('uTexA'), 0)
    gl.uniform1i(u('uTexB'), 1)
    gl.enable(gl.DEPTH_TEST)

    const makeTex = (unit: number) => {
      const tex = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 38, 36, 255]))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return tex
    }
    const texA = makeTex(0)
    const texB = makeTex(1)
    const upload = (unit: number, tex: WebGLTexture | null, img: HTMLCanvasElement) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    }

    let disposed = false
    const loaded: HTMLCanvasElement[] = []
    Promise.all(patterns.map((p) => loadPatternCanvas(p.src).catch(() => null))).then((list) => {
      if (disposed) return
      list.forEach((c) => c && loaded.push(c))
      if (loaded[0]) upload(0, texA, loaded[0])
      if (loaded[1]) upload(1, texB, loaded[1])
    })

    // ขนาด canvas ตามจอ (จำกัด DPR ไว้ที่ 2 กันเครื่องช้า)
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uAspect, w / Math.max(h, 1))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // เมาส์ → เอียงผ้า (นุ่ม ๆ ด้วยการไล่ค่า)
    const target = { x: 0, y: 0 }
    const tilt = { x: 0, y: 0 }
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.35
      target.y = (e.clientY / window.innerHeight - 0.5) * -0.25
    }
    window.addEventListener('pointermove', onPointer)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)

    let raf = 0
    let current = 0
    let lastSwitch = performance.now()
    const start = performance.now()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden) return

      // สลับลาย: B จางทับ A แล้วสลับบทบาท
      let mix = 0
      if (loaded.length > 1) {
        const since = now - lastSwitch
        if (since > SWITCH_MS) {
          mix = Math.min((since - SWITCH_MS) / FADE_MS, 1)
          if (mix >= 1) {
            current = (current + 1) % loaded.length
            upload(0, texA, loaded[current])
            upload(1, texB, loaded[(current + 1) % loaded.length])
            lastSwitch = now
            mix = 0
          }
        }
      }

      tilt.x += (target.x - tilt.x) * 0.05
      tilt.y += (target.y - tilt.y) * 0.05

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.uniform1f(uTime, reduce ? 2.0 : (now - start) / 1000)
      gl.uniform2f(uTilt, reduce ? 0 : tilt.x, reduce ? 0 : tilt.y)
      gl.uniform1f(uMix, mix)
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      gl.deleteBuffer(uvBuf)
      gl.deleteBuffer(idxBuf)
      gl.deleteTexture(texA)
      gl.deleteTexture(texB)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [ox, oy, oz])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}

export default FabricHero
