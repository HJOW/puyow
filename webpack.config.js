const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
module.exports = {
    "entry" : ["./src/js/puyow.js"],
    "output" : {
        "path" : __dirname + "/src/bundle/",
        "filename" : "puyow.bundle.js",
        "clean" : true
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
                "test" : /\.(ts|js|mjs)$/,
                "exclude" : [
                    '/node_modules/'
                ],
                "use" : {
                    "loader" : "babel-loader"
                }
            }
        ]
    },
    "plugins" : [
        new CleanWebpackPlugin({
            "cleanAfterEveryBuildPatterns" : ['**/*.LICENSE.txt'],
            "protectWebpackAssets" : false
        }),
        new ESLintPlugin({
            "extensions" : ["js", "mjs", "ts"],
            "exclude" : ["node_modules", "three.min.js", "json5.min.js"]
        }),
        new webpack.BannerPlugin({
            "banner" : `/** Shutting Stars
 * @author HJOW <hujinone22@naver.com>
 * @license Apache-2.0 
 * 
 * GitHub : https://github.com/HJOW/puyow
 * 
 * Dependencies
 *     three.min.js (https://threejs.org/) - MIT License
 *     json5.min.js (https://json5.org/  ) - MIT License
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