# Puyo W 그래픽 좌표 체계

게임 화면과 외부 렌더러는 실제 출력 해상도와 관계없이 같은 논리 좌표계를 사용합니다. 사용자 정의 적 초상화·테마·뿌요를 그릴 때도 아래 기준을 사용하면 됩니다.

## 논리 좌표계

- 게임의 논리 캔버스 크기는 **1280 x 720**입니다.
- 원점 `(0, 0)`은 캔버스 왼쪽 위이며, X는 오른쪽으로, Y는 아래로 증가합니다.
- `CanvasRenderingContext2D`에는 게임 렌더링 전에 논리 좌표 변환이 적용됩니다. 따라서 외부 렌더러도 실제 픽셀이 아닌 1280 x 720 기준의 좌표·길이·선 두께를 사용합니다.

## 출력 해상도와 그래픽 설정

설정 화면의 `그래픽 설정`은 `puyow_store.settings.graphicsQuality`에 저장됩니다. 기본값은 `low`이며, 기존 저장 데이터에 이 값이 없어도 자동으로 `low`로 보정합니다. 설정을 저장하면 실제 canvas의 `width`와 `height`가 아래 값으로 즉시 바뀝니다. CSS 표시 크기와 게임 내부 논리 좌표계는 변하지 않습니다.

| 값 | 표시 문구 | 실제 canvas 출력 해상도 |
| --- | --- | --- |
| `low` | 낮음 | 1280 x 720 |
| `medium` | 중간 | 1920 x 1080 |
| `high` | 높음 | 3840 x 2160 |

그래픽 품질은 실제 canvas의 출력 크기만 바꾸고 CSS 표시 크기와 게임 내부 논리 좌표계는 바꾸지 않습니다. 라이브러리는 렌더링 전에 컨텍스트 변환을 적용하므로 `fillRect`, `fillText`, 선 두께, 사용자 정의 렌더러의 좌표와 길이도 실제 출력 해상도로 함께 변환됩니다. 고해상도 출력은 메모리와 렌더링 부하를 높일 수 있으므로 저사양 기기에서는 `낮음`을 권장합니다.

## 출력 좌표 변환 API

외부 코드에서 현재 출력 크기와 변환 결과를 확인할 수 있습니다.

```js
const output = PuyoW.getCanvasOutputSize();
// { graphicsQuality: 'medium', width: 1920, height: 1080, scaleX: 1.5, scaleY: 1.5 }

PuyoW.toCanvasCoordinates(640, 360);
// { x: 960, y: 540 }

PuyoW.toCanvasLength(38);
// 57
```

`PuyoW.applyCanvasCoordinateTransform()`은 현재 그래픽 설정의 논리 좌표 변환을 2D 컨텍스트에 다시 적용합니다. 외부 렌더링 코드가 `setTransform()`으로 컨텍스트 좌표계를 변경했을 때 호출할 수 있습니다. 보통 게임 렌더링 과정에서 자동 적용되므로 별도로 호출할 필요는 없습니다.

독립 3D 버전은 제공하지 않습니다. 2D 게임 위의 선택적 Three.js 연출은 투명 3D canvas를 사용할 수 있지만, 게임 입력과 논리 좌표계는 2D canvas가 계속 담당합니다.

## 화면 맞춤 모드와 여백

게임을 웹 페이지에 어떻게 맞출지는 `PuyoW.initialize()`를 호출하기 **전에** 아래 함수로 정합니다. 초기화한 뒤에 호출하면 오류가 납니다(`destroy()` 후에는 다시 바꿀 수 있습니다).

```js
PuyoW.setCanvasFitMode(1);                                    // 0 또는 1 (기본값 1)
PuyoW.setCanvasFitMargin({ top: 60, right: 0, bottom: 90, left: 0 }); // px 단위, 생략한 방향은 0
// PuyoW.setCanvasFitMargin(16);                              // 숫자 하나는 네 방향 모두 같은 값
PuyoW.initialize('puyow_target');

PuyoW.getCanvasFit();    // { mode: 1, margin: { top: 60, right: 0, bottom: 90, left: 0 } }
PuyoW.getScreenLayout(); // { fitMode, margin, rotated, viewport, canvasRect }
```

| 모드 | 동작 |
| --- | --- |
| `0` | 스크립트가 크기를 조절하지 않습니다. 최상위 div의 크기는 페이지의 HTML·CSS가 정하고, 두 canvas는 그 div를 가득 채웁니다. **게임 자체의 화면 방향 전환(세로 화면 90도 회전)은 지원하지 않으며** `화면 가로방향 고정` 설정도 영향이 없습니다. CSS를 따로 주지 않으면 기본값은 `width: 100%; aspect-ratio: 16 / 9`입니다. 이 기본 규칙은 명시도 0(`:where(.div_puyow_root)`)이라 페이지 CSS로 언제든 덮어쓸 수 있습니다. div 비율이 16:9가 아니면 화면이 늘어나 보이므로 비율은 페이지에서 맞춰 주세요. |
| `1` (기본값) | 브라우저 화면(`window.innerWidth` x `window.innerHeight`)에서 여백을 뺀 영역에 16:9 게임 화면을 맞춥니다. 화면 크기가 바뀌거나 방향이 바뀌면 다시 맞춥니다. |

모드 1의 배치 규칙은 다음과 같습니다.

- **여백**: `canvasFitMargin`의 `top`·`right`·`bottom`·`left`(px)만큼 화면 가장자리를 비워 둡니다. 최상위 div는 여백을 뺀 영역 크기가 되고, div의 `margin`이 이 여백이 됩니다. 비운 공간에는 페이지 HTML로 광고나 다른 콘텐츠를 배치할 수 있습니다. 여백은 회전 여부와 관계없이 항상 **실제 웹 화면 기준**입니다.
- **짧은 쪽에 맞춤**: 여백을 뺀 영역이 16:9보다 가로로 길면(예: 17:9) 세로를 100% 채우고 양옆이 남습니다. 16:9보다 가로가 짧으면(예: 4:3) 가로를 100% 채우고 위아래가 남습니다. 남는 공간은 양쪽에 똑같이 나누어 게임 화면을 가운데에 둡니다.
- **세로 화면**: 화면의 세로가 가로보다 길고 `화면 가로방향 고정` 설정이 꺼져 있으면 게임 화면을 시계 방향으로 90도 돌립니다. 기기를 90도 돌려서 보는 사용자에게는 위 규칙이 똑같이 적용된 것처럼 보입니다. 이때 `body`에는 `puyow-portrait` 클래스가 붙습니다.
- **입력 좌표**: 마우스·터치 입력은 2D canvas의 실제 표시 영역(`getBoundingClientRect()`)을 기준으로 논리 1280 x 720 좌표로 되돌리므로, 여백·가운데 정렬·회전 상태에서도 그대로 동작합니다.
- 모드 1은 최상위 div에 `position`·`box-sizing`·`width`·`height`·`margin`을, 두 canvas에 `left`·`top`·`width`·`height`·`transform`·`transform-origin`을 인라인 스타일로 넣습니다. 이 속성들을 페이지 CSS로 바꾸려면 모드 0을 쓰세요. `destroy()`는 넣었던 인라인 스타일을 지웁니다.

`PuyoW.getScreenLayout()`은 현재 맞춤 모드, 여백, 회전 여부, 뷰포트 크기, 2D canvas의 화면상 영역(`canvasRect`, CSS px)을 돌려줍니다. 같은 값은 WebMCP `screen_layout` 도구로도 조회할 수 있습니다. `rotated`가 true이면 논리 X(0~1280)는 `canvasRect.top`에서 아래로, 논리 Y(0~720)는 `canvasRect`의 오른쪽 끝에서 왼쪽으로 증가합니다.

---

[개발 안내](../HOWTO.md) · [적·AI](Enemy.md) · [뿌요](Puyo.md) · [시뮬레이터·피버](Simulator.md) · [사운드](Sound.md)
