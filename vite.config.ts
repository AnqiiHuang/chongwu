import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 项目页是 https://anqiihuang.github.io/chongwu/，base 必须是 /chongwu/。
// 部署到域名根目录时，把 base 改成 '/'。
export default defineConfig({
  base: '/chongwu/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
