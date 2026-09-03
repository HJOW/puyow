# Puyo W

브라우저에서 즐기는 2D 뿌요 대전 퍼즐 게임입니다.
같은 색 4개의 뿌요가 만나면 터집니다.
연쇄 폭발을 일으켜 강력한 공격을 일으켜 보세요.

## Do you want to see english document?

[English README](README.en.md)

## 지금 플레이

[https://hjow.github.io/puyow/](https://hjow.github.io/puyow/) 에 접속하여 플레이해 보세요.

또는
[https://puyow-8745b.web.app](https://puyow-8745b.web.app) 에서도 플레이 가능.

## 게임 시작

메인 화면에서 `게임 시작`을 선택한 뒤 난이도와 상대를 고르고 `시작`을 누르면 3초 카운트다운 후 대전이 시작됩니다. 처음에는 안드로말리우스와만 대전할 수 있으며, 승리한 뒤 다음 상대가 순서대로 열립니다.

`연습`을 선택하면 공격하지 않는 연습 상대와 자유롭게 플레이할 수 있습니다. 메인 화면 왼쪽 아래의 `GitHub` 버튼은 프로젝트 저장소를 새 창으로 엽니다.

## 조작 방법

| 키 | 동작 |
| --- | --- |
| 왼쪽/오른쪽 방향키 | 뿌요 쌍을 좌우로 이동 |
| 아래 방향키 | 빠르게 아래로 이동 |
| Z | 왼쪽으로 회전 |
| X | 오른쪽으로 회전 |
| ESC | 게임 중 일시정지 화면 열기 |
| Enter | 메뉴, 일시정지 화면의 포커스된 버튼 실행 |

일시정지 화면에서는 방향키로 `재개`와 `종료`를 고르고 `Enter`를 누릅니다. 게임 종료 화면에서는 중앙의 `종료` 버튼을 클릭하거나 `Enter` 또는 `ESC`를 눌러 적 선택 화면으로 돌아갑니다.

## 게임 규칙

- 각 플레이어는 가로 6칸 세로 12칸의 공간에서 게임을 진행합니다.
- 같은 색 뿌요가 상하좌우로 4개 이상 연결되면 폭발합니다. 점수가 발생하며 상대에게 공격할 수 있습니다.
- 공격 시 상대방 공간에 방해뿌요를 발생시키게 됩니다.
- 뿌요 폭발의 연쇄가 높을 수록 높은 점수와 공격력이 대폭 상승합니다.
- 보이는 최상단의 세 번째 칸에 뿌요가 있으면 패배합니다.

## 대전 진행

뿌요를 고정하면 필드에 중력이 적용되고, 폭발할 뿌요가 있는지 확인합니다. 폭발과 낙하가 반복되는 동안 연쇄 수가 올라가며, 모든 연쇄가 끝난 뒤 남은 공격이 상대에게 전달됩니다. 받은 방해뿌요는 다음 차례에 필드 위에서 떨어집니다.

필드를 뿌요와 방해뿌요 없이 완전히 비우면 싹쓸이가 발동해 상대에게 큰 피해를 보냅니다. 단, 뿌요를 한 번 이상 놓은 뒤에만 싹쓸이가 발동합니다.

## 화면 안내

중앙 상단에는 플레이어와 CPU의 다음 뿌요 2쌍이 각각 표시됩니다. 중앙 중간에는 선택한 적의 초상화가, 중앙 하단에는 양쪽 점수가 표시됩니다.   
뿌요가 폭발하면 해당 위치에 연쇄 수가 나타나 위로 떠오르고, 2초 뒤 사라집니다.

## 로컬에서 구동을 위한 사전 준비

1. git 과 node.js 를 설치합니다.    
   Git - [git scm](https://git-scm.com/install/windows)   
   Node.js - [Node.js](https://nodejs.org/ko/download) - Windows 의 경우 설치 프로그램 (msi) 버전 이용    
   
2. git을 통해 설치   
   명령 프롬프트 (Windows) / 터미널 (MacOS/Linux) 을 열고    
   PuyoW 를 설치할 디렉토리로 접근한 후   
   명령어 `git clone https://github.com/HJOW/puyow.git` 입력, 엔터   

3. npm 패키지 설치
   명령 프롬프트 (Windows) / 터미널 (MacOS/Linux) 창에서     
   명령어 `npm install` 입력, 엔터   

## 로컬에서 실행

1. 서버 구동
   명령 프롬프트 (Windows) / 터미널 (MacOS/Linux) 을 열고    
   PuyoW 가 설치된 디렉토리로 접근   
   명령어 `npm start` 입력, 엔터    
    
2. 접속, 플레이
   웹 브라우저 (Googld Chrome / MS Edge / Naver Whale / Mozilla Firefox / ...) 로    
   주소 `localhost:9891` 입력해 접속   
   즐기기    

3. 게임 종료     
   웹 브라우저 종료   
   명령 프롬프트 (Windows) / 터미널 (MacOS/Linux) 창에서    
   단축키 CTRL + C 입력    

## Bun 호환성

Bun (https://bun.com/) 을 사용하여 서버 구동을 더 빠르게 진행할 수 있습니다.    
공식 홈페이지에서 bun 을 설치한 후,    
명령어 `npm start` 대신 `bun start` 를 이용하세요.

## 개발 안내

게임 설정, 라이브러리 사용법, 새 AI 상대 제작 방법은 [HOWTO.md](HOWTO.md)를 참고하세요.

## 소스 디렉토리 구조

- 저장소 루트의 `index.html`은 `src/index.html`로 이동시키는 진입점입니다.
- `src/puyow.html`은 실제 2D 게임 페이지이며, 핵심 코드는 `src/js/puyow.js`에 있습니다.
- 스타일은 `src/css/puyow.css`, 선택적 라이브러리는 `src/js/`에, 아이콘은 `src/img/`에 있습니다.
- 언어별 공지사항은 `src/notice/`, Webpack 배포 번들은 `src/bundle/`에 있습니다.

## AI 사용 고지

이 프로젝트는 개발 과정에서 AI 도구를 활용했습니다. 생성되거나 제안된 코드와 문서는 프로젝트 관리자가 검토하고 프로젝트에 맞게 수정했습니다.

## 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE)에 따라 배포됩니다.

## Third Parties

+ Three.js (선택사항으로 일부 특수효과에만 사용)

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
