// ES Module로 작성한 게임 소스(src/js/puyow*.js)를 테스트에서 일반 스크립트로 실행할 때 쓰는 도우미다.
// Node vm이나 page.addScriptTag()의 일반 스크립트는 import/export 문을 해석하지 못하므로, 한 줄짜리 import/export 문을 지우고
// 최상위 선언이 전역을 더럽히지 않게 IIFE로 감싼다. 파일 이름이 *.spec.js가 아니므로 Playwright가 테스트 파일로 수집하지 않는다.
import { readFileSync } from 'node:fs';

/**
 * ES Module 소스를 일반 스크립트로 바꾼다. `module`이 있는 환경(Node vm)에서는 지정한 최상위 변수를 module.exports로 공개한다.
 * @param {string} source ES Module 소스
 * @param {string} [exportName='WebPuyo'] module.exports로 공개할 최상위 변수 이름
 * @returns {string} 일반 스크립트 소스
 */
export function toClassicScript(source, exportName = 'WebPuyo') {
  const body = source.replace(/\r\n/g, '\n')
    // 기본 가져오기(`import X from '...';`)는 같은 이름의 전역 값으로 바꾼다. JSON5는 없으면 표준 JSON으로 대신한다.
    .replace(/^import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+['"];?\s*$/gm, (_, name) => (
      name === 'JSON5' ? 'const JSON5 = globalThis.JSON5 || JSON;' : `const ${name} = globalThis.${name};`
    ))
    .replace(/^(?:import|export)\s.*$/gm, '');
  return `(() => {\n'use strict';\n${body}\nif (typeof module !== 'undefined' && module.exports) module.exports = ${exportName};\n})();\n`;
}

/**
 * 파일을 읽어 일반 스크립트로 바꾼다.
 * @param {string} filePath 저장소 루트 기준 파일 경로
 * @param {string} [exportName='WebPuyo'] module.exports로 공개할 최상위 변수 이름
 * @returns {string} 일반 스크립트 소스
 */
export function readClassicScript(filePath, exportName = 'WebPuyo') {
  return toClassicScript(readFileSync(filePath, 'utf8'), exportName);
}
