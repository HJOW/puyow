const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
/*
 * src/js/puyow*.js 는 ES Module 로 작성한다. 이 설정은 게임 페이지(puyow.html)가 일반 <script> 로 읽을 수 있고,
 * Node.js 에서 require() 로도 쓸 수 있는 CommonJS 호환(UMD) 번들 src/bundle/puyow.bundle.js 를 만든다.
 *     - 브라우저: window.PuyoW / window.WebPuyo (puyow.js 가 직접 등록) 와 window.PuyoW3DEffect·window.THREE (puyow_3d.js 가 등록)
 *     - Node.js : require('./src/bundle/puyow.bundle.js') 가 puyow.js 의 기본 내보내기(PuyoW)를 돌려준다.
 * ES Module 라이브러리도 import 를 따라 함께 묶는다.
 *     - json5.js                               : puyow.js 가 import
 *     - three.module.min.js, three.core.min.js : puyow_3d.js 가 import
 * crypto-js.min.js, ort.all.min.js 는 전역 변수를 만드는 선택 라이브러리라 번들에 넣지 않고 페이지에서 따로 읽는다.
 */
module.exports = {
    // 배열의 마지막 모듈(puyow.js)의 내보내기가 번들의 내보내기가 된다. 3D 효과 모듈은 부수 효과(window.PuyoW3DEffect 등록)만 쓴다.
    "entry" : ["./src/js/puyow_3d.js", "./src/js/puyow.js"],
    "output" : {
        "path" : __dirname + "/src/bundle/",
        "filename" : "puyow.bundle.js",
        "clean" : true,
        "library" : {
            "name" : "PuyoW",
            "type" : "umd",
            "export" : "default"
        },
        // UMD 래퍼가 브라우저(self)와 Node.js(this) 어디서든 전역 객체를 찾도록 한다.
        "globalObject" : "typeof self !== 'undefined' ? self : this"
    },
    "mode" : "production",
    "optimization" : {
        "minimize" : true,
        "minimizer" : [
            new TerserPlugin({
                "extractComments" : false,
                "terserOptions" : {
                    "format" : {
                        "comments" : false
                    },
                    "mangle" : {
                        "keep_classnames" : true
                    }
                }
            })
        ]
    },
    "module" : {
        "rules" : [
            {
                // 루트 package.json 의 "type" 은 "commonjs" 이므로, 게임 모듈은 ES Module 로 해석하도록 명시한다.
                // (src/js/package.json 의 "type": "module" 과 같은 뜻이며, Node.js 의 node --check·import() 는 그 파일을 따른다.)
                "test" : /[\\/]src[\\/]js[\\/](?:puyow[^\\/]*|three\.(?:core|module)\.min|json5)\.js$/,
                "type" : "javascript/esm"
            },
            {
                "test" : /\.(ts|js|mjs)$/,
                // 이미 배포용으로 만들어진 외부 라이브러리(.min.js, json5.js)는 변환하지 않는다.
                "exclude" : /node_modules|[\\/]src[\\/]bundle[\\/]|\.min\.js$|[\\/]json5\.js$/,
                "use" : {
                    "loader" : "babel-loader"
                }
            }
        ]
    },
    "plugins" : [
        // three.module.min.js 는 공식 배포본 그대로 "./three.core.js" 를 import 하므로, 저장소에 둔 three.core.min.js 로 바꿔 묶는다.
        new webpack.NormalModuleReplacementPlugin(/^\.\/three\.core\.js$/, './three.core.min.js'),
        new CleanWebpackPlugin({
            "cleanAfterEveryBuildPatterns" : ['**/*.LICENSE.txt'],
            "protectWebpackAssets" : false
        }),
        new ESLintPlugin({
            "extensions" : ["js", "mjs", "ts"],
            "exclude" : ["node_modules", "three.min.js", "three.core.min.js", "three.module.min.js", "three.webgpu.min.js", "json5.min.js", "json5.js", "crypto-js.min.js", "ort.all.min.js"]
        }),
        new webpack.BannerPlugin({
            "banner" : `/** Puyo W
 * @author HJOW <hujinone22@naver.com>
 * @license Apache-2.0
 *
 * GitHub : https://github.com/HJOW/puyow
 *
 * Bundled modules : puyow.js, puyow_3d.js (ES Module -> UMD/CommonJS)
 *
 * Bundled dependencies
 *     three.module.min.js, three.core.min.js (https://threejs.org/        ) - MIT License
 *     json5.js                               (https://json5.org/          ) - MIT License
 *
 */`,
            "footer" : false,
            "raw" : true,
            "stage" : webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT
        })
    ],
    "performance" : {
        "hints" : "warning",
        "maxAssetSize" : 2097152,
        "maxEntrypointSize" : 2097152
    }
}
