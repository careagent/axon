import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/taxonomy/index.ts',
    './src/questionnaires/index.ts',
    './src/types/index.ts',
    './src/mock/index.ts',
    './src/server/index.ts',
    './src/server/standalone.ts',
  ],
  format: ['es'],
  platform: 'node',
  dts: true,
  clean: true,
  fixedExtension: false,
  inlineOnly: ['@sinclair/typebox'],
})
