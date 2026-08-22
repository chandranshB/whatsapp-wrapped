import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Absolute base path so built asset URLs are always rooted at the repo
  // sub-path, not resolved relative to whatever page URL is active.
  // Without this, navigating to /whatsapp-wrapped/wrapped makes the browser
  // look for ./assets/... relative to /whatsapp-wrapped/wrapped/ → 404 →
  // blank white page.
  base: '/whatsapp-wrapped/',
})
