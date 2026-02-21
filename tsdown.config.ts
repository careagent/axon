import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['es'],
  platform: 'node',
  dts: true,
  clean: true,
  fixedExtension: false,
})
