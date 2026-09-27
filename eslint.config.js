const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
    {
        ignores: [
            '**/node_modules/**',
            'src/js/three.min.js',
            'src/js/three.core.min.js',
            'src/js/three.module.min.js',
            'src/js/three.webgpu.min.js',
            'src/js/json5.min.js',
            'src/js/json5.js',
            'src/js/ort.all.min.js',
            'src/js/crypto-js.min.js',
            'src/bundle/**'
        ],
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            // src/js/puyow*.js 는 ES Module 이다. (Webpack 이 CommonJS 호환 번들로 바꾼다)
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn',
        },
        rules: {
            ...js.configs.recommended.rules,
            // 공개 API, 콜백, 상속용 메서드의 함수와 매개변수는 미사용이어도 유지한다.
            'no-unused-vars': 'off',
        },
    },
]
