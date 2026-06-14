import { defineConfig } from 'vite';

export default defineConfig({
  // ベースパスを相対パスにして、任意のサブドメイン/サブフォルダ（GitHub Pages等）で動くようにします
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // キャッシュ対策としてアセットファイル名にハッシュを付与
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
