/**
 * node.js 기반 웹 서버 기동
 *
 * 사용법)
 *     1. 사전 준비
 *            node.js 를 설치한다.
 * 
 *     2. 서버 실행 (명령 프롬프트 / 터미널로 이 프로젝트 최상위 디렉토리로 접근하여 수행)
 *            npm start
 * 
 *     3. 서버 종료
 *            프로세스를 종료시키거나, 해당 명령 프롬프트 / 터미널 창에서 CTRL+C 입력
 *
 *     4. 포트 지정하여 서버 실행 (포트 미지정 시 기본 포트 9891 사용)
 *
 * 필요사항)
 *     1. node.js 사전 설치 필요
 *     2. 명령 프롬프트 / 터미널에서, cd 명령어로 프로젝트 최상위 디렉토리 (README.md 파일이 있는) 에 접근하여 수행해야 한다.
*/
/*

LICENSE

Copyright 2026 HJOW (hujinone22@naver.com)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. 
 
 */

const http = require('http')
const fs   = require('fs');
const path = require('path');

// 포트
let PORT = 9891;
// 웹 경로
const WEB_ROOT = path.join(__dirname, './src');

// 매개변수 검사
if(process.argv.length >= 3) { // process.argv 배열 1, 2번은 예약되어 있음, 3번부터 매개변수가 들어오기 시작함
    PORT = parseInt(process.argv[2]); // 첫 번째 매개변수로 포트 입력
}

// 이 문구들이 들어간 URL은 서비스 되지 않음
const blacklistFilePattern = [
    '/WEB-INF/',
    '/META-INF/'
];

// 동적 URL
const apis = {};

const server = http.createServer((req, res) => {
    // URL 경로 설정 (기본값: index.html)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const url = req.url;
    console.log('REQUEST : ' + url + ' by ' + ip);

    // blacklist 처리
    for(let idx=0; idx<blacklistFilePattern.length; idx++) {
        const blacklistOne = blacklistFilePattern[idx];
        if(url.indexOf(blacklistOne) >= 0) {
            res.writeHead(403, {'Content-Type': 'text/plain'});
            res.end('403 Forbidden');
            return;
        }
    }

    // 동적 URL 처리
    if(url.indexOf('/apis/') == 0) {
        let prefRemoved = url.substring(6);
        let nextSlash = prefRemoved.indexOf('/');
        if(nextSlash < 0) nextSlash = prefRemoved.length;

        let apiName = prefRemoved.substring(0, nextSlash);
        let funcObj = apis[apiName];

        if(typeof(funcObj) == 'undefined' || funcObj == null) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('404 Not Found');
            return;
        }

        let results = funcObj(req, res);
        if(typeof(results) == 'undefined') return;
        if(typeof(results) == 'object') results = JSON.stringify(results);
        if(typeof(results) != 'string') results = String(results);

        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(results, 'utf-8');
        return;
    }

    // 정적 URL 처리
    let filePath = path.join(WEB_ROOT, req.url === '/' ? 'index.html' : req.url);

    // 위 filePath 에는 URL 매개변수 Query String 이 포함되어 있을수가 있음. Query String 분리
    const queryIndex = filePath.indexOf('?');
    let queryString = '';
    if(queryIndex >= 0) {
        queryString = filePath.substring(queryIndex + 1);
        filePath = filePath.substring(0, queryIndex);
    }

    // 파일 확장자 추출
    const extname = path.extname(filePath);
    let contentType = 'application/octet-stream';

    switch (extname) {
        case '.html': contentType = 'text/html'; break;
        case '.htm': contentType = 'text/html'; break;
        case '.txt': contentType = 'text/plain'; break;
        case '.js': contentType = 'text/javascript'; break;
        case '.mjs': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.json5': contentType = 'application/json5'; break;
        case '.xml': contentType = 'application/xml'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpeg'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.ico': contentType = 'image/vnd.microsoft.icon'; break;
        case '.mp3': contentType = 'audio/mpeg'; break;
        case '.ogg': contentType = 'audio/ogg'; break;
        case '.wav': contentType = 'audio/wav'; break;
        case '.mp4': contentType = 'video/mp4'; break;
        case '.weba': contentType = 'audio/webm'; break;
        case '.webm': contentType = 'video/webm'; break;
        case '.webp': contentType = 'image/webp'; break;
        case '.ttf': contentType = 'font/ttf'; break;
        case '.otf': contentType = 'font/otf'; break;
        case '.woff': contentType = 'font/woff'; break;
        case '.woff2': contentType = 'font/woff2'; break;
        case '.zip': contentType = 'application/zip'; break;
        case '.7z': contentType = 'application/x-7z-compressed'; break;
        case '.gz': contentType = 'application/gzip'; break;
        case '.jar': contentType = 'application/java-archive'; break;
        case '.csv': contentType = 'text/csv'; break;
        case '.pdf': contentType = 'application/pdf'; break;
        case '.docx': contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break;
        case '.pptx': contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; break;
        case '.xlsx': contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if(err) {
            if(err.code == 'ENOENT') {
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end('404 Not Found');
                return;
            } else {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        } else {
            res.writeHead(200, {'Content-Type': contentType});
            res.end(content, 'utf-8');
        }
    });
});

server.on('close', () => {
    console.log('Server with ' + PORT + ' will be shutdown !');
});

server.on('error', (err) => {
    console.log('Server with ' + PORT + ' error !');
    console.error(err);
});

server.listen(PORT, () => {
    console.log('Server in running with ' + PORT + ' port !');
    console.log('    WEB ROOT : ' + WEB_ROOT);
});