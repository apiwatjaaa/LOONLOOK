import type { SlotConfig } from '../store/useOutfit'
import { buildGarment, buildMannequin, type Mesh } from './geometry'

/**
 * ฉาก 3 มิติของสตูดิโอ (WebGL2 ล้วน)
 * - หุ่น + ชุดแต่ละชิ้นเป็น mesh, ลายผ้า/สี/เนื้อผ้าทำใน shader
 * - ลากเพื่อหมุน, ล้อเมาส์/ปุ่มเพื่อซูม, หมุนเองช้า ๆ เมื่อไม่มีคนแตะ
 */

export type Piece = { slot: string; garmentId: string; patternSrc: string; config: SlotConfig }

export type SceneApi = {
  setPieces: (pieces: Piece[]) => void
  setView: (yaw: number) => void
  zoomBy: (factor: number) => void
  setAutoRotate: (on: boolean) => void
  setFrame: (narrow: boolean) => void
  dispose: () => void
}

const VERT = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vPos;
out vec3 vNrm;
out vec2 vUv;
void main() {
  vPos = aPos;
  vNrm = aNrm;
  vUv = aUv;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNrm;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform int uMode;      // 0 = ตัวหุ่น, 1 = ผ้า
uniform vec3 uTint;
uniform float uTintOn;
uniform float uHue;
uniform float uSat;
uniform float uTile;
uniform float uRot;
uniform int uFinish;    // 0 ด้าน, 1 ซาติน, 2 ยีนส์, 3 ไหมพรม
uniform float uFold;
uniform vec3 uCam;

vec3 hueRotate(vec3 c, float a) {
  float cs = cos(a), sn = sin(a);
  mat3 m = mat3(
    0.213 + cs * 0.787 - sn * 0.213, 0.213 - cs * 0.213 + sn * 0.143, 0.213 - cs * 0.213 - sn * 0.787,
    0.715 - cs * 0.715 - sn * 0.715, 0.715 + cs * 0.285 + sn * 0.140, 0.715 - cs * 0.715 + sn * 0.715,
    0.072 - cs * 0.072 + sn * 0.928, 0.072 - cs * 0.072 - sn * 0.283, 0.072 + cs * 0.928 + sn * 0.072);
  return clamp(m * c, 0.0, 1.0);
}

void main() {
  vec3 n = normalize(vNrm);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uCam - vPos);
  vec3 base;
  float specS = 0.22;
  float specP = 22.0;
  float shade = 1.0;

  if (uMode == 0) {
    base = vec3(0.90, 0.87, 0.83);
  } else {
    // รอยพับผ้า: เบี่ยง normal เป็นคลื่นแนวตั้ง (กระโปรงลึกกว่าเสื้อ)
    float fold = sin(vUv.x * 34.0 + sin(vUv.y * 7.0) * 1.6) + 0.5 * sin(vUv.x * 71.0 - vUv.y * 3.0);
    vec3 side = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + 1e-4);
    n = normalize(n + uFold * fold * side);
    shade = 1.0 - uFold * 0.35 * (0.5 - 0.5 * fold);

    float c = cos(uRot), s = sin(uRot);
    vec2 uv = mat2(c, -s, s, c) * vUv / uTile;
    vec3 t = texture(uTex, uv).rgb;
    t = hueRotate(t, uHue);
    float l = dot(t, vec3(0.299, 0.587, 0.114));
    t = mix(vec3(l), t, uSat);
    base = uTintOn > 0.5 ? clamp(uTint * (0.38 + 1.05 * l), 0.0, 1.0) : t;

    specS = 0.05;
    specP = 8.0;
    if (uFinish == 1) { specS = 0.6; specP = 40.0; }
    if (uFinish == 2) {
      float tw = fract((vUv.x + vUv.y) * 260.0);
      base *= 0.8 + 0.2 * smoothstep(0.0, 0.5, tw) * smoothstep(1.0, 0.5, tw);
    }
    if (uFinish == 3) {
      base *= 0.82 + 0.18 * (0.5 + 0.5 * sin(vUv.x * 520.0));
    }
  }

  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.75));
  vec3 L2 = normalize(vec3(0.8, 0.25, 0.35));
  vec3 L3 = normalize(vec3(0.0, 0.4, -1.0));
  float d = max(dot(n, L1), 0.0) * 0.82 + max(dot(n, L2), 0.0) * 0.28 + max(dot(n, L3), 0.0) * 0.45 + 0.3;
  float sp = pow(max(dot(reflect(-L1, n), v), 0.0), specP) * specS;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.12;
  // เงาใกล้พื้น
  float ground = mix(0.78, 1.0, smoothstep(0.0, 0.5, vPos.y));
  vec3 col = base * d * shade * ground + vec3(sp) + vec3(rim);
  outColor = vec4(pow(col, vec3(1.0 / 1.08)), 1.0);
}`

type Gpu = { vao: WebGLVertexArrayObject; count: number; buffers: WebGLBuffer[] }

type Mat4 = Float32Array

function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}

function lookAt(eye: number[], target: number[]): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2]
  let l = Math.hypot(zx, zy, zz)
  zx /= l; zy /= l; zz /= l
  let xx = zz, xy = 0, xz = -zx // up = (0,1,0) × z
  l = Math.hypot(xx, xy, xz) || 1
  xx /= l; xy /= l; xz /= l
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx
  const m = new Float32Array(16)
  m[0] = xx; m[1] = yx; m[2] = zx
  m[4] = xy; m[5] = yy; m[6] = zy
  m[8] = xz; m[9] = yz; m[10] = zz
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2])
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2])
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2])
  m[15] = 1
  return m
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}

const FINISH_ID: Record<string, number> = { matte: 0, satin: 1, denim: 2, knit: 3 }
const SLOT_ORDER: Record<string, number> = { bottom: 0, full: 1, top: 1, accessory: 2 }

export function createMannequinScene(canvas: HTMLCanvasElement): SceneApi | null {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false })
  if (!gl) return null

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const prog = gl.createProgram()!
  try {
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  } catch (err) {
    console.warn('[Mannequin3D]', err)
    return null
  }
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[Mannequin3D]', gl.getProgramInfoLog(prog))
    return null
  }
  gl.useProgram(prog)
  const loc = (n: string) => gl.getUniformLocation(prog, n)
  const U = {
    proj: loc('uProj'), view: loc('uView'), tex: loc('uTex'), mode: loc('uMode'), tint: loc('uTint'),
    tintOn: loc('uTintOn'), hue: loc('uHue'), sat: loc('uSat'), tile: loc('uTile'), rot: loc('uRot'),
    finish: loc('uFinish'), fold: loc('uFold'), cam: loc('uCam'),
  }
  const A = { pos: gl.getAttribLocation(prog, 'aPos'), nrm: gl.getAttribLocation(prog, 'aNrm'), uv: gl.getAttribLocation(prog, 'aUv') }
  gl.enable(gl.DEPTH_TEST)
  gl.uniform1i(U.tex, 0)

  const upload = (m: Mesh): Gpu => {
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    const buffers: WebGLBuffer[] = []
    const attr = (data: number[], at: number, size: number) => {
      const b = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(at)
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0)
      buffers.push(b)
    }
    attr(m.pos, A.pos, 3)
    attr(m.nrm, A.nrm, 3)
    attr(m.uv, A.uv, 2)
    const ib = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(m.idx), gl.STATIC_DRAW)
    buffers.push(ib)
    gl.bindVertexArray(null)
    return { vao, count: m.idx.length, buffers }
  }

  const body = upload(buildMannequin())
  const garmentCache = new Map<string, { gpu: Gpu; fold: number } | null>()
  const getGarment = (id: string) => {
    if (!garmentCache.has(id)) {
      const g = buildGarment(id)
      garmentCache.set(id, g ? { gpu: upload(g.mesh), fold: g.fold } : null)
    }
    return garmentCache.get(id) ?? null
  }

  // ลายผ้า → texture (วาดลง canvas 256x256 ให้ทำซ้ำได้)
  const grey = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, grey)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 196, 190, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  const texCache = new Map<string, WebGLTexture>()
  const getTexture = (src: string): WebGLTexture => {
    const hit = texCache.get(src)
    if (hit) return hit
    const tex = gl.createTexture()!
    texCache.set(src, tex)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 196, 190, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    const img = new Image()
    img.onload = () => {
      if (disposed) return
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      c.getContext('2d')?.drawImage(img, 0, 0, 256, 256)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      dirty = true
    }
    img.src = src
    return tex
  }

  let pieces: Piece[] = []
  let disposed = false
  let dirty = true

  // กล้องโคจรรอบหุ่น
  const cam = { yaw: 0.35, pitch: 0.08, dist: 3.75, targetYaw: 0.35, targetDist: 3.75 }
  let autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let narrowFrame = false
  let lastInput = 0

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    dirty = true
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  // ลาก = หมุน / ล้อเมาส์ = ซูม
  let dragging = false
  let lastX = 0
  let lastY = 0
  const onDown = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
    lastInput = performance.now()
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    cam.targetYaw -= (e.clientX - lastX) * 0.011
    cam.pitch = Math.min(0.45, Math.max(-0.05, cam.pitch + (e.clientY - lastY) * 0.004))
    lastX = e.clientX
    lastY = e.clientY
    lastInput = performance.now()
    dirty = true
  }
  const onUp = () => {
    dragging = false
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    cam.targetDist = Math.min(4.4, Math.max(1.5, cam.targetDist * (1 + e.deltaY * 0.001)))
    lastInput = performance.now()
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  const drawGpu = (g: Gpu) => {
    gl.bindVertexArray(g.vao)
    gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0)
  }

  let raf = 0
  let prev = performance.now()
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    if (document.hidden) return

    if (autoRotate && !dragging && now - lastInput > 3500) {
      cam.targetYaw += dt * 0.35
    }
    const dy = cam.targetYaw - cam.yaw
    const dd = cam.targetDist - cam.dist
    if (Math.abs(dy) > 1e-4 || Math.abs(dd) > 1e-4) dirty = true
    cam.yaw += dy * Math.min(1, dt * 7)
    cam.dist += dd * Math.min(1, dt * 7)
    if (!dirty) return
    dirty = false

    const target = [0, 0.9 - (3.75 - cam.dist) * 0.05, 0]
    const eye = [
      target[0] + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      target[1] + Math.sin(cam.pitch) * cam.dist,
      target[2] + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    ]
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    const aspect = canvas.width / canvas.height
    // จอแคบ: ขยายมุมกล้องตามความกว้าง ไม่ให้หุ่นล้นขอบ
    const fov = aspect < 0.55 || narrowFrame ? Math.min(1.1, 2 * Math.atan(Math.tan(0.31) * (0.55 / Math.min(aspect, 0.55)))) : 0.62
    gl.uniformMatrix4fv(U.proj, false, perspective(fov, aspect, 0.05, 30))
    gl.uniformMatrix4fv(U.view, false, lookAt(eye, target))
    gl.uniform3f(U.cam, eye[0], eye[1], eye[2])

    // ตัวหุ่น
    gl.uniform1i(U.mode, 0)
    gl.uniform1f(U.fold, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, grey)
    drawGpu(body)

    // ชุด: ท่อนล่าง → ท่อนบน → เครื่องประดับ (ชั้นนอกสุดวาดหลังสุด)
    gl.uniform1i(U.mode, 1)
    for (const p of [...pieces].sort((a, b) => (SLOT_ORDER[a.slot] ?? 0) - (SLOT_ORDER[b.slot] ?? 0))) {
      const g = getGarment(p.garmentId)
      if (!g) continue
      const c = p.config
      gl.bindTexture(gl.TEXTURE_2D, getTexture(p.patternSrc))
      const tint = c.tint ? hexToRgb(c.tint) : [1, 1, 1]
      gl.uniform3f(U.tint, tint[0], tint[1], tint[2])
      gl.uniform1f(U.tintOn, c.tint ? 1 : 0)
      gl.uniform1f(U.hue, ((c.hue ?? 0) * Math.PI) / 180)
      gl.uniform1f(U.sat, (c.saturation ?? 100) / 100)
      gl.uniform1f(U.tile, 0.085 * (c.scale || 1))
      gl.uniform1f(U.rot, ((c.rotation ?? 0) * Math.PI) / 180)
      gl.uniform1i(U.finish, FINISH_ID[c.finish ?? 'matte'] ?? 0)
      gl.uniform1f(U.fold, g.fold)
      drawGpu(g.gpu)
    }
    gl.bindVertexArray(null)
  }
  raf = requestAnimationFrame(frame)

  return {
    setPieces(next) {
      pieces = next
      dirty = true
    },
    setView(yaw) {
      // หมุนไปมุมที่ใกล้ที่สุด
      const k = Math.round((cam.targetYaw - yaw) / (Math.PI * 2))
      cam.targetYaw = yaw + k * Math.PI * 2
      lastInput = performance.now()
    },
    zoomBy(f) {
      cam.targetDist = Math.min(4.4, Math.max(1.5, cam.targetDist * f))
      lastInput = performance.now()
    },
    setFrame(narrow) {
      narrowFrame = narrow
      dirty = true
    },
    setAutoRotate(on) {
      autoRotate = on
      lastInput = 0
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      const all = [body, ...[...garmentCache.values()].filter((g): g is { gpu: Gpu; fold: number } => !!g).map((g) => g.gpu)]
      for (const g of all) {
        g.buffers.forEach((b) => gl.deleteBuffer(b))
        gl.deleteVertexArray(g.vao)
      }
      texCache.forEach((t) => gl.deleteTexture(t))
      gl.deleteTexture(grey)
      gl.deleteProgram(prog)
    },
  }
}
