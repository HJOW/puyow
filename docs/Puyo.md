# Puyo W 뿌요 API

일반·방해뿌요는 내장 클래스가 렌더링하고, 공격 예고줄은 `WarningPuyo` 하위 클래스로 확장할 수 있습니다. 일반 뿌요의 보드 표현은 문자열을 유지하므로 게임 상태와 저장 데이터의 호환성도 유지됩니다.

## 내장 일반·방해뿌요 클래스

`WebPuyo.Puyo`는 일반·방해뿌요의 공통 기반 클래스입니다. 다음 내장 클래스는 `getName()`과 `draw(drawingContext, x, y, cellSize, scale)`를 제공하며, 갤러리와 게임 렌더러도 같은 객체를 사용합니다.

- 일반뿌요: `RedPuyo`, `GreenPuyo`, `YellowPuyo`, `BluePuyo`, `PurplePuyo`
- 방해뿌요: `GarbagePuyo`, `HardGarbagePuyo`

`draw()`의 `drawingContext`는 2D 캔버스 컨텍스트이고, `x`, `y`, `cellSize`는 논리 좌표계 값입니다. 일반 슬라임 계열은 선택 사항인 `scale`과 `slimeDetails`도 받을 수 있습니다. 렌더링 좌표의 기준은 [Graphics.md](Graphics.md)를 참고하세요.

보드·저장 데이터·공개 상태의 종류 문자열은 이전과 동일하게 `'red'`, `'green'`, `'yellow'`, `'blue'`, `'purple'`, `'garbage'`, `'hardGarbage'`를 유지합니다. 기존 게임 로직은 이 문자열을 계속 사용하고, 화면에 그릴 때만 해당 클래스 객체의 `draw()`로 위임합니다.

## 사용자 정의 예고뿌요 클래스

방해뿌요 예고줄은 `WebPuyo.WarningPuyo` 객체로 구성됩니다. 하위 클래스는 `getName()`으로 표시 이름을 바꾸고 `draw()`로 모양을 그리며, 필요한 경우 `getDisplayX()`로 같은 종류 아이콘의 가로 배치를 조정할 수 있습니다.

`WebPuyo.registerWarningPuyo()`에 하위 클래스를 전달하면 새 단위를 등록할 수 있습니다. 등록은 반드시 `initialize()` 전에 해야 하며, 등록된 클래스는 `static unitCount`의 큰 값부터 자동 정렬됩니다.

클래스에는 다음 계약이 필요합니다.

- `static unitCount`: 양의 정수 단위값입니다.
- 생성자: `super(클래스명.unitCount, '고유한-종류명')`을 호출해야 합니다. 인스턴스의 `unitCount`는 static 값과 같아야 합니다.
- `draw(drawingContext, x, y, cellSize)`: 예고뿌요 한 개를 그립니다. `x`, `y`, `cellSize`는 게임의 논리 좌표와 셀 크기입니다.
- 선택 사항인 `getDisplayX(startX, index, sameTypeIndex)`를 재정의하면 같은 종류 예고뿌요의 가로 배치를 바꿀 수 있습니다.

```js
class CrownWarningPuyo extends WebPuyo.WarningPuyo {
    static unitCount = 100;

    constructor() {
        super(CrownWarningPuyo.unitCount, 'crown');
    }

    draw(drawingContext, x, y, cellSize) {
        drawingContext.save();
        drawingContext.translate(x + cellSize / 2, y + cellSize / 2);
        drawingContext.fillStyle = '#c98b24';
        drawingContext.beginPath();
        drawingContext.moveTo(-cellSize * 0.35, cellSize * 0.26);
        drawingContext.lineTo(-cellSize * 0.35, -cellSize * 0.26);
        drawingContext.lineTo(0, -cellSize * 0.02);
        drawingContext.lineTo(cellSize * 0.35, -cellSize * 0.26);
        drawingContext.lineTo(cellSize * 0.35, cellSize * 0.26);
        drawingContext.closePath();
        drawingContext.fill();
        drawingContext.restore();
    }
}

WebPuyo.registerWarningPuyo(CrownWarningPuyo);
WebPuyo.initialize('webpuyo_canvas');
```

같은 클래스를 두 번 등록하거나, `WarningPuyo`를 상속하지 않은 클래스, `draw()`를 구현하지 않은 클래스, 잘못된 단위값을 등록하면 오류가 발생합니다. 예고줄에는 기존과 같이 최대 6개 아이콘만 표시됩니다.

---

[개발 안내](../HOWTO.md) · [그래픽](Graphics.md) · [적·AI](Enemy.md) · [시뮬레이터·피버](Simulator.md) · [사운드](Sound.md)
