import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import manifest from './manifest.json';

export default defineConfig({
    plugins: [
        crx({ manifest }),
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/onnxruntime-web/dist/*.wasm',
                    dest: 'assets/wasm'
                },
                {
                    src: 'node_modules/onnxruntime-web/dist/*.mjs',
                    dest: 'assets/wasm'
                }
            ]
        })
    ],
    build: {
        rollupOptions: {
            input: {
                popup: 'popup.html',
            },
        },
    },
});
