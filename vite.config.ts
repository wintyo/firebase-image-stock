import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3500,
  },
  resolve: {
    alias: {
      // 上手くaliasの設定ができていない
      '~/': path.resolve(__dirname, './src/'),
    },
  },
  plugins: [vue()],
});
