import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // เปิดให้เข้าผ่าน Wi-Fi เดียวกันได้ (หน้าที่ไม่ใช้กล้องเข้าได้ปกติ)
  },
})
