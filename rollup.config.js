import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';

const pkg = require('./package.json');

export default {
    input: [
        'src/index.js'
    ],
    output: [
        {file: pkg.module, format: 'iife', name: 'GuitarTuner'},
        {file: pkg.main, format: 'iife', name: 'GuitarTuner'},
    ],
    plugins: [
        svelte({
            customElement: true,
            tag: 'guitar-tuner',
            emitCss: true,
            css: (css) => {
                css.write('dist/build/guitar-tuner.css');
            }
        }),
        resolve({
                extensions: ['.svelte', '.mjs', '.js', '.jsx', '.json'],
                mainFields: ['jsnext:main', 'module', 'main']
            }
        )
    ]
};
