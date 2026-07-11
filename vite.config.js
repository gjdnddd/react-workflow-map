import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages는 https://<user>.github.io/react-workflow-map/ 하위 경로로 서빙되므로
// base를 저장소 이름으로 지정한다. 로컬 dev(npm run dev)에서는 base가 '/'처럼 동작.
// https://vite.dev/config/
export default defineConfig({
  base: '/react-workflow-map/',
  plugins: [react()],
})
