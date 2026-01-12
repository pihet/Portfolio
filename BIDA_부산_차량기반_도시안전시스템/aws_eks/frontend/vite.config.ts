import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // 프로덕션에서 정적 파일 경로를 루트 기준으로 설정
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined, // 모든 chunk를 하나로 번들링하지 않음
      },
    },
  },
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 가능
    port: 5173,
    strictPort: false, // 포트가 사용 중이면 다른 포트 사용
  },
  preview: {
    host: '0.0.0.0', // 미리보기 서버도 모든 네트워크 인터페이스에서 접근 가능
    port: 5173,
    strictPort: false,
  },
})
