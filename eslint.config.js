const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
    {
        ignores: [
            '**/node_modules/**',
            'src/js/three.min.js',
            'src/js/json5.min.js',
            'src/bundle/**'
        ],
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
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
