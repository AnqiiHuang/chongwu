import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub 仓库 AnqiiHuang/chongwu，项目页路径为 /chongwu/。
// 部署到域名根目录时，把 base 改成 '/'。
export default defineConfig({
  base: '/chongwu/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
