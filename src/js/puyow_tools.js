/*
    뿌요 W 개발용 도구 (피버 패턴 / 퍼즐뿌요 제작)

        Copyright 2026 HJOW

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    이 파일은 tools.html 전용이다. 게임 페이지(puyow.html)는 이 파일을 읽지 않는다.
    화면 구성과 스크립트 생성은 모두 이 파일이 맡고, 뿌요 배치 편집과 테스트 실행은
    puyow.js가 내보내는 PuyoW.tools API를 통해 게임 본체의 코드를 그대로 재사용한다.
*/
(() => {
    'use strict';

    /**
     * 도구 화면에서만 쓰는 문구의 다국어 표다.
     * 도구 페이지의 기본 언어는 영어이므로 영어 원문을 키로 쓰고, 지원하는 다른 언어인
     * 한국어 번역만 여기에 둔다. 게임 본체(puyow.js)의 번역표와는 별개다.
     * @type {Object<string, Object<string,string>>}
     */
    const TOOLS_STRINGS = {
        ko: {
            'Puyo W Dev Tools': '뿌요 W 개발 도구',
            'Edit FEVER Pattern': '피버 패턴 개발',
            'Edit Puzzle Puyo': '퍼즐뿌요 개발',
            'Choose what to develop.': '개발할 대상을 선택해 주세요.',
            'Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.': '화면 위쪽에서 "퍼즐뿌요 개발" 또는 "피버 패턴 개발"을 선택하세요.',
            'Use a screen that is wider than it is tall.': '가로가 더 넓은 화면에서 사용해 주세요.',
            'Editing a FEVER pattern.': '피버 패턴을 편집합니다.',
            'Editing a Puzzle Puyo stage.': '퍼즐뿌요 스테이지를 편집합니다.',
            'Choose again after the test finishes.': '테스트가 끝난 뒤에 다시 선택해 주세요.',
            'Existing data loaded.': '기존 데이터를 불러왔습니다.',
            'Existing pattern loaded.': '기존 패턴을 불러왔습니다.',
            'Load failed: %1': '불러오기 실패: %1',
            'Script generated.': '스크립트를 생성했습니다.',
            'Script generation failed: %1': '스크립트 생성 실패: %1',
            'Test failed: %1': '테스트 실패: %1',
            'FEVER test in progress. Play with the keyboard. (ESC: pause)': '피버 테스트 중입니다. 키보드로 조작하세요. (ESC: 일시정지)',
            'Puzzle Puyo test in progress. Play with the keyboard. (ESC: pause)': '퍼즐뿌요 테스트 중입니다. 키보드로 조작하세요. (ESC: 일시정지)',
            'Test succeeded. You can now generate the script.': '테스트에 성공했습니다. 이제 스크립트를 생성할 수 있습니다.',
            'Test failed: the first supplied pair made %1 chains, but exactly %2 chains are required.': '테스트 실패: 처음 지급받은 뿌요로 %1연쇄를 만들었지만, 정확히 %2연쇄여야 합니다.',
            'Test failed: the goal was not reached.': '테스트 실패: 목표를 달성하지 못했습니다.',
            'Test failed: the goal was reached on turn %1, but the turn limit is %2.': '테스트 실패: %1턴에 목표를 달성했지만, 목표 턴수는 %2턴입니다.',
            'Test failed: the chain was %1, but exactly %2 chains are required.': '테스트 실패: %1연쇄를 만들었지만, 정확히 %2연쇄여야 합니다.',
            'Run a successful test before generating the script.': '스크립트를 생성하려면 먼저 테스트에 성공해야 합니다.',
            'The data changed after the test. Run the test again before generating the script.': '테스트 후 내용이 바뀌었습니다. 스크립트를 생성하려면 테스트를 다시 해 주세요.',
            'You can add up to %1 colors.': '색상은 최대 %1개까지 넣을 수 있습니다.',
            'Load': '불러오기',
            'Script': '스크립트',
            'Existing Patterns': '기존 패턴',
            'FEVER Pattern': '피버 패턴 정보',
            'Target Chain': '목표 연쇄 수',
            'Difficulty': '난이도',
            'Target chain is an integer from %1 to %2, and difficulty an integer of 1 or more.': '목표 연쇄 수는 %1 ~ %2 사이의 정수, 난이도는 1 이상의 정수입니다.',
            'Colors In Use': '사용할 색상 목록',
            'No.': '순번',
            'Color': '색상',
            'Delete': '삭제',
            'Add Color': '색상 추가',
            'Only red, blue, green, yellow and purple can be chosen. Use %1 to %2 colors, and do not add the same color twice.': 'red, blue, green, yellow, purple 중에서만 고를 수 있습니다. %1 ~ %2개의 색을 사용해야 하며, 같은 색을 두 번 넣을 수 없습니다.',
            'Controls': '조작',
            'Test': '테스트',
            'Generate Script': '스크립트 생성',
            'Pick a puyo from the palette at the right of the canvas, then click or drag on the left play field and on the "Next Puyos" cells in the middle.': '캔버스 오른쪽 팔레트에서 뿌요를 고른 뒤, 왼쪽 플레이 영역과 가운데 "다음에 나올 뿌요" 칸을 클릭하거나 끌어서 배치합니다.',
            'Puzzle Puyo': '퍼즐뿌요 정보',
            'Win Condition': '목표 타입',
            'Condition Value': '목표 타입 값',
            'Turn Limit': '목표 턴수',
            'Hint': '힌트',
            'Turn limit is an integer from %1 to %2, and the next puyos must be filled for at least that many turns. The hint may be left empty.': '목표 턴수는 %1 ~ %2 사이의 정수이며, "다음에 나올 뿌요"를 최소 그 턴수만큼 채워야 합니다. 힌트는 비워 둘 수 있습니다.',
            'Generated Script': '생성된 스크립트',
            'Load Script': '스크립트 불러오기',
            'Load Existing Pattern': '기존 패턴 불러오기',
            'Choose a pattern to load into the editor.': '편집 화면에 불러올 패턴을 선택해 주세요.',
            'There is no pattern to load.': '불러올 패턴이 없습니다.',
            'Paste a script written as new FeverStageState(...) or new PuzzlePuyoStage({...}).': 'new FeverStageState(...) 또는 new PuzzlePuyoStage({...}) 형태의 스크립트를 붙여 넣어 주세요.',
            'OK': '확인',
            'Cancel': '취소',
            'Settings': '설정',
            'Use Dark Mode': '다크 모드 사용',
            'Turning dark mode off lightens the tool screen. The game test area keeps its own colors.': '다크 모드를 끄면 도구 화면이 밝은 톤으로 바뀝니다. 게임 테스트 영역의 색은 그대로입니다.',
            'Save': '저장',
            'Settings saved.': '설정을 저장했습니다.',
            'Auto Generate': '자동생성',
            'Stop': '중단',
            'Auto generation failed: %1': '자동생성 실패: %1',
            'Auto generation finished. %1 puyos were added.': '자동생성을 마쳤습니다. 뿌요 %1개를 더했습니다.',
            'Auto generation stopped.': '자동생성을 중단했습니다.',
            'Looking for a layout that reaches the goal on the first turn...': '첫 턴에 목표를 이룰 수 있는 배치를 찾고 있습니다...',
            'Could not find a layout that reaches the goal. Try changing the goal or the puyos already placed.': '목표를 이룰 수 있는 배치를 찾지 못했습니다. 목표나 이미 놓은 뿌요를 바꿔 보세요.',
            'Looking for a layout that makes exactly %1 chains...': '정확히 %1연쇄가 되는 배치를 찾고 있습니다...',
            'Could not find a layout that makes exactly %1 chains. Try changing the colors in use or the puyos already placed.': '정확히 %1연쇄가 되는 배치를 찾지 못했습니다. 사용할 색상 목록이나 이미 놓은 뿌요를 바꿔 보세요.',
            'This browser cannot run the background search.': '이 브라우저에서는 배경 탐색을 실행할 수 없습니다.',
            'The puyos already on the play field pop on their own.': '플레이 영역에 이미 놓인 뿌요들이 스스로 터집니다.',
            'The puyos already on the play field make more chains than the target.': '플레이 영역에 이미 놓인 뿌요들이 목표보다 많은 연쇄를 만듭니다.',
            'The background search stopped with an error.': '배경 탐색이 오류로 멈췄습니다.',
            'The settings were applied but could not be saved.': '설정을 적용했지만 저장하지 못했습니다.',
            'combo (chain)': 'combo (연쇄)',
            'Win when the target chain count is reached.': '목표 연쇄 수를 달성하면 승리',
            'clear (all clear)': 'clear (싹쓸이)',
            'Win on an all clear. The condition value is not used.': '싹쓸이 발생 시 승리 (목표 값 없음)',
            'multiple (puyos popped at once)': 'multiple (동시 폭발 수)',
            'Win when the puyos popped at once in one chain reach the target count.': '한 번의 연쇄에 동시에 터지는 뿌요 수가 목표 수 이상',
            'color (colors popped at once)': 'color (동시 폭발 색 수)',
            'Win when the colors popped at once in one chain reach the target count. Garbage puyos are excluded.': '한 번의 연쇄에 동시에 터지는 색 수가 목표 수 이상 (방해뿌요 제외)',
            'attack (attack amount)': 'attack (공격량)',
            'Win when ATTACK plus DAMAGE momentarily reaches the target count.': 'ATTACK + DAMAGE 합이 순간적으로 목표 수 이상',
            'red': '빨강',
            'green': '초록',
            'yellow': '노랑',
            'blue': '파랑',
            'purple': '보라',
            'puyow.js must be loaded first.': 'puyow.js를 먼저 불러와야 합니다.',
            'This puyow.js build has no dev tools API.': '이 puyow.js 빌드에는 개발용 도구 API가 없습니다.',
            'Enter the script to load.': '불러올 스크립트를 입력해 주세요.',
            'The script could not be parsed. (%1)': '스크립트를 해석할 수 없습니다. (%1)',
            'Not a FeverStageState or PuzzlePuyoStage object.': 'FeverStageState 또는 PuzzlePuyoStage 객체가 아닙니다.',
            'The editor is not ready.': '편집 화면이 준비되지 않았습니다.',
            'Place at least one puyo on the play field.': '플레이 영역에 뿌요를 하나 이상 배치해 주세요.',
            'Enter %1.': '%1을(를) 입력해 주세요.',
            '%1 must be an integer.': '%1은(는) 정수여야 합니다.',
            'Target chain must be from %1 to %2.': '목표 연쇄 수는 %1 이상 %2 이하여야 합니다.',
            'Difficulty must be an integer of 1 or more.': '난이도는 1 이상의 정수여야 합니다.',
            'The colors in use must have %1 to %2 colors.': '사용할 색상 목록에는 %1 ~ %2개의 색이 있어야 합니다.',
            'The colors in use contain "%1" more than once.': '사용할 색상 목록에 "%1"이(가) 두 번 이상 있습니다.',
            'Fill both cells of the next puyos.': '"다음에 나올 뿌요"의 두 칸을 모두 채워 주세요.',
            'The color "%1" on the play field is not in the colors in use.': '플레이 영역의 "%1" 색이 사용할 색상 목록에 없습니다.',
            'The color "%1" of the next puyos is not in the colors in use.': '"다음에 나올 뿌요"의 "%1" 색이 사용할 색상 목록에 없습니다.',
            'One cell of turn %1 of the next puyos is empty.': '"다음에 나올 뿌요" %1턴의 한 칸이 비어 있습니다.',
            'There is an empty turn before turn %1 of the next puyos.': '"다음에 나올 뿌요" %1턴 앞에 비어 있는 턴이 있습니다.',
            'Fill the next puyos for all %1 turns of the turn limit.': '"다음에 나올 뿌요"를 목표 턴수인 %1턴만큼 모두 채워 주세요.',
            'Choose a win condition.': '목표 타입을 선택해 주세요.',
            'The condition value must be an integer of 1 or more.': '목표 타입 값은 1 이상의 정수여야 합니다.',
            'The turn limit must be from %1 to %2.': '목표 턴수는 %1 ~ %2 사이여야 합니다.',
            'Could not find the element to build the dev tools in.': '개발용 도구를 넣을 요소를 찾을 수 없습니다.'
        },
        ja: {
            'Puyo W Dev Tools': 'ぷよ W 開発ツール',
            'Edit FEVER Pattern': 'FEVERパターン開発',
            'Edit Puzzle Puyo': 'なぞぷよ開発',
            'Choose what to develop.': '開発する対象を選んでください。',
            'Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.': '画面上部で「なぞぷよ開発」または「FEVERパターン開発」を選んでください。',
            'Use a screen that is wider than it is tall.': '横に広い画面でご利用ください。',
            'Editing a FEVER pattern.': 'FEVERパターンを編集します。',
            'Editing a Puzzle Puyo stage.': 'なぞぷよステージを編集します。',
            'Choose again after the test finishes.': 'テストが終わってから選び直してください。',
            'Existing data loaded.': '既存データを読み込みました。',
            'Existing pattern loaded.': '既存パターンを読み込みました。',
            'Load failed: %1': '読み込み失敗: %1',
            'Script generated.': 'スクリプトを生成しました。',
            'Script generation failed: %1': 'スクリプト生成失敗: %1',
            'Test failed: %1': 'テスト失敗: %1',
            'FEVER test in progress. Play with the keyboard. (ESC: pause)': 'FEVERテスト中です。キーボードで操作してください。(ESC: 一時停止)',
            'Puzzle Puyo test in progress. Play with the keyboard. (ESC: pause)': 'なぞぷよテスト中です。キーボードで操作してください。(ESC: 一時停止)',
            'Test succeeded. You can now generate the script.': 'テストに成功しました。スクリプトを生成できます。',
            'Test failed: the first supplied pair made %1 chains, but exactly %2 chains are required.': 'テスト失敗: 最初に配られたぷよで%1連鎖になりましたが、ちょうど%2連鎖である必要があります。',
            'Test failed: the goal was not reached.': 'テスト失敗: 目標を達成できませんでした。',
            'Test failed: the goal was reached on turn %1, but the turn limit is %2.': 'テスト失敗: %1手目で目標を達成しましたが、目標手数は%2手です。',
            'Test failed: the chain was %1, but exactly %2 chains are required.': 'テスト失敗: %1連鎖になりましたが、ちょうど%2連鎖である必要があります。',
            'Run a successful test before generating the script.': 'スクリプトを生成するには、先にテストへ成功してください。',
            'The data changed after the test. Run the test again before generating the script.': 'テスト後に内容が変わりました。スクリプトを生成するにはテストをやり直してください。',
            'You can add up to %1 colors.': '色は最大%1個まで追加できます。',
            'Load': '読み込み',
            'Script': 'スクリプト',
            'Existing Patterns': '既存パターン',
            'FEVER Pattern': 'FEVERパターン情報',
            'Target Chain': '目標連鎖数',
            'Difficulty': '難易度',
            'Target chain is an integer from %1 to %2, and difficulty an integer of 1 or more.': '目標連鎖数は%1 ~ %2の整数、難易度は1以上の整数です。',
            'Colors In Use': '使用する色の一覧',
            'No.': '番号',
            'Color': '色',
            'Delete': '削除',
            'Add Color': '色を追加',
            'Only red, blue, green, yellow and purple can be chosen. Use %1 to %2 colors, and do not add the same color twice.': 'red, blue, green, yellow, purple からのみ選べます。%1 ~ %2個の色を使い、同じ色を二度追加することはできません。',
            'Controls': '操作',
            'Test': 'テスト',
            'Generate Script': 'スクリプト生成',
            'Pick a puyo from the palette at the right of the canvas, then click or drag on the left play field and on the "Next Puyos" cells in the middle.': 'キャンバス右のパレットでぷよを選び、左のプレイ領域と中央の「NEXTぷよ」のマスをクリックまたはドラッグしてください。',
            'Puzzle Puyo': 'なぞぷよ情報',
            'Win Condition': '目標タイプ',
            'Condition Value': '目標タイプの値',
            'Turn Limit': '目標手数',
            'Hint': 'ヒント',
            'Turn limit is an integer from %1 to %2, and the next puyos must be filled for at least that many turns. The hint may be left empty.': '目標手数は%1 ~ %2の整数で、「NEXTぷよ」は少なくともその手数分を埋める必要があります。ヒントは空でも構いません。',
            'Generated Script': '生成されたスクリプト',
            'Load Script': 'スクリプトの読み込み',
            'Load Existing Pattern': '既存パターンの読み込み',
            'Choose a pattern to load into the editor.': '編集画面に読み込むパターンを選んでください。',
            'There is no pattern to load.': '読み込めるパターンがありません。',
            'Paste a script written as new FeverStageState(...) or new PuzzlePuyoStage({...}).': 'new FeverStageState(...) または new PuzzlePuyoStage({...}) の形式のスクリプトを貼り付けてください。',
            'OK': '確認',
            'Cancel': 'キャンセル',
            'Settings': '設定',
            'Use Dark Mode': 'ダークモードを使う',
            'Turning dark mode off lightens the tool screen. The game test area keeps its own colors.': 'ダークモードを切ると、ツール画面が明るい配色になります。ゲームのテスト領域の色はそのままです。',
            'Save': '保存',
            'Settings saved.': '設定を保存しました。',
            'Auto Generate': '自動生成',
            'Stop': '中断',
            'Auto generation failed: %1': '自動生成に失敗: %1',
            'Auto generation finished. %1 puyos were added.': '自動生成が終わりました。ぷよを%1個追加しました。',
            'Auto generation stopped.': '自動生成を中断しました。',
            'Looking for a layout that reaches the goal on the first turn...': '最初の手で目標を達成できる配置を探しています…',
            'Could not find a layout that reaches the goal. Try changing the goal or the puyos already placed.': '目標を達成できる配置が見つかりませんでした。目標や、すでに置いたぷよを変えてみてください。',
            'Looking for a layout that makes exactly %1 chains...': 'ちょうど%1連鎖になる配置を探しています…',
            'Could not find a layout that makes exactly %1 chains. Try changing the colors in use or the puyos already placed.': 'ちょうど%1連鎖になる配置が見つかりませんでした。使用する色の一覧や、すでに置いたぷよを変えてみてください。',
            'This browser cannot run the background search.': 'このブラウザではバックグラウンド探索を実行できません。',
            'The puyos already on the play field pop on their own.': 'プレイ領域にすでに置かれているぷよが自分で消えてしまいます。',
            'The puyos already on the play field make more chains than the target.': 'プレイ領域にすでに置かれているぷよが、目標より多く連鎖してしまいます。',
            'The background search stopped with an error.': 'バックグラウンド探索がエラーで止まりました。',
            'The settings were applied but could not be saved.': '設定を適用しましたが、保存できませんでした。',
            'combo (chain)': 'combo (連鎖)',
            'Win when the target chain count is reached.': '目標の連鎖数に達すると成功です。',
            'clear (all clear)': 'clear (全消し)',
            'Win on an all clear. The condition value is not used.': '全消しで成功です。目標タイプの値は使いません。',
            'multiple (puyos popped at once)': 'multiple (同時消し数)',
            'Win when the puyos popped at once in one chain reach the target count.': '一度の連鎖で同時に消えたぷよの数が目標に達すると成功です。',
            'color (colors popped at once)': 'color (同時消しの色数)',
            'Win when the colors popped at once in one chain reach the target count. Garbage puyos are excluded.': '一度の連鎖で同時に消えた色の数が目標に達すると成功です。おじゃまぷよは含みません。',
            'attack (attack amount)': 'attack (攻撃量)',
            'Win when ATTACK plus DAMAGE momentarily reaches the target count.': 'ATTACKとDAMAGEの合計が一時的に目標へ達すると成功です。',
            'red': '赤',
            'green': '緑',
            'yellow': '黄',
            'blue': '青',
            'purple': '紫',
            'puyow.js must be loaded first.': '先に puyow.js を読み込む必要があります。',
            'This puyow.js build has no dev tools API.': 'この puyow.js には開発ツールAPIがありません。',
            'Enter the script to load.': '読み込むスクリプトを入力してください。',
            'The script could not be parsed. (%1)': 'スクリプトを解析できませんでした。(%1)',
            'Not a FeverStageState or PuzzlePuyoStage object.': 'FeverStageState でも PuzzlePuyoStage でもないオブジェクトです。',
            'The editor is not ready.': '編集画面の準備ができていません。',
            'Place at least one puyo on the play field.': 'プレイ領域にぷよを1つ以上置いてください。',
            'Enter %1.': '%1を入力してください。',
            '%1 must be an integer.': '%1は整数でなければなりません。',
            'Target chain must be from %1 to %2.': '目標連鎖数は%1 ~ %2でなければなりません。',
            'Difficulty must be an integer of 1 or more.': '難易度は1以上の整数でなければなりません。',
            'The colors in use must have %1 to %2 colors.': '使用する色の一覧には%1 ~ %2個の色が必要です。',
            'The colors in use contain "%1" more than once.': '使用する色の一覧に "%1" が二度以上入っています。',
            'Fill both cells of the next puyos.': '「NEXTぷよ」の2マスとも埋めてください。',
            'The color "%1" on the play field is not in the colors in use.': 'プレイ領域の色 "%1" が使用する色の一覧にありません。',
            'The color "%1" of the next puyos is not in the colors in use.': '「NEXTぷよ」の色 "%1" が使用する色の一覧にありません。',
            'One cell of turn %1 of the next puyos is empty.': '「NEXTぷよ」%1手目の片方のマスが空です。',
            'There is an empty turn before turn %1 of the next puyos.': '「NEXTぷよ」%1手目より前に空の手があります。',
            'Fill the next puyos for all %1 turns of the turn limit.': '「NEXTぷよ」を目標手数である%1手分すべて埋めてください。',
            'Choose a win condition.': '目標タイプを選んでください。',
            'The condition value must be an integer of 1 or more.': '目標タイプの値は1以上の整数でなければなりません。',
            'The turn limit must be from %1 to %2.': '目標手数は%1 ~ %2でなければなりません。',
            'Could not find the element to build the dev tools in.': '開発ツールを入れる要素が見つかりませんでした。'
        },
        zh: {
            'Puyo W Dev Tools': 'Puyo W 开发工具',
            'Edit FEVER Pattern': 'FEVER 图案开发',
            'Edit Puzzle Puyo': '解谜魔法气泡开发',
            'Choose what to develop.': '请选择要开发的对象。',
            'Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.': '请在屏幕上方选择“解谜魔法气泡开发”或“FEVER 图案开发”。',
            'Use a screen that is wider than it is tall.': '请在宽度大于高度的屏幕上使用。',
            'Editing a FEVER pattern.': '正在编辑 FEVER 图案。',
            'Editing a Puzzle Puyo stage.': '正在编辑解谜魔法气泡关卡。',
            'Choose again after the test finishes.': '请在测试结束后重新选择。',
            'Existing data loaded.': '已载入现有数据。',
            'Existing pattern loaded.': '已载入现有图案。',
            'Load failed: %1': '载入失败：%1',
            'Script generated.': '已生成脚本。',
            'Script generation failed: %1': '脚本生成失败：%1',
            'Test failed: %1': '测试失败：%1',
            'FEVER test in progress. Play with the keyboard. (ESC: pause)': 'FEVER 测试进行中。请用键盘操作。（ESC：暂停）',
            'Puzzle Puyo test in progress. Play with the keyboard. (ESC: pause)': '解谜魔法气泡测试进行中。请用键盘操作。（ESC：暂停）',
            'Test succeeded. You can now generate the script.': '测试成功。现在可以生成脚本了。',
            'Test failed: the first supplied pair made %1 chains, but exactly %2 chains are required.': '测试失败：用最初发放的气泡形成了 %1 连锁，但必须正好是 %2 连锁。',
            'Test failed: the goal was not reached.': '测试失败：未能达成目标。',
            'Test failed: the goal was reached on turn %1, but the turn limit is %2.': '测试失败：在第 %1 回合达成目标，但目标回合数为 %2。',
            'Test failed: the chain was %1, but exactly %2 chains are required.': '测试失败：形成了 %1 连锁，但必须正好是 %2 连锁。',
            'Run a successful test before generating the script.': '要生成脚本，请先通过测试。',
            'The data changed after the test. Run the test again before generating the script.': '测试后内容已更改。要生成脚本，请重新测试。',
            'You can add up to %1 colors.': '最多可以添加 %1 种颜色。',
            'Load': '载入',
            'Script': '脚本',
            'Existing Patterns': '现有图案',
            'FEVER Pattern': 'FEVER 图案信息',
            'Target Chain': '目标连锁数',
            'Difficulty': '难度',
            'Target chain is an integer from %1 to %2, and difficulty an integer of 1 or more.': '目标连锁数是 %1 ~ %2 的整数，难度是 1 以上的整数。',
            'Colors In Use': '使用的颜色列表',
            'No.': '序号',
            'Color': '颜色',
            'Delete': '删除',
            'Add Color': '添加颜色',
            'Only red, blue, green, yellow and purple can be chosen. Use %1 to %2 colors, and do not add the same color twice.': '只能从 red、blue、green、yellow、purple 中选择。须使用 %1 ~ %2 种颜色，且不能重复添加同一种颜色。',
            'Controls': '操作',
            'Test': '测试',
            'Generate Script': '生成脚本',
            'Pick a puyo from the palette at the right of the canvas, then click or drag on the left play field and on the "Next Puyos" cells in the middle.': '在画布右侧的调色板中选择气泡，然后在左侧游戏区域和中间的“下一个气泡”格子上点击或拖动。',
            'Puzzle Puyo': '解谜魔法气泡信息',
            'Win Condition': '目标类型',
            'Condition Value': '目标类型数值',
            'Turn Limit': '目标回合数',
            'Hint': '提示',
            'Turn limit is an integer from %1 to %2, and the next puyos must be filled for at least that many turns. The hint may be left empty.': '目标回合数是 %1 ~ %2 的整数，“下一个气泡”至少要填满这么多回合。提示可以留空。',
            'Generated Script': '生成的脚本',
            'Load Script': '载入脚本',
            'Load Existing Pattern': '载入现有图案',
            'Choose a pattern to load into the editor.': '请选择要载入编辑画面的图案。',
            'There is no pattern to load.': '没有可载入的图案。',
            'Paste a script written as new FeverStageState(...) or new PuzzlePuyoStage({...}).': '请粘贴写成 new FeverStageState(...) 或 new PuzzlePuyoStage({...}) 形式的脚本。',
            'OK': '确认',
            'Cancel': '取消',
            'Settings': '设置',
            'Use Dark Mode': '使用深色模式',
            'Turning dark mode off lightens the tool screen. The game test area keeps its own colors.': '关闭深色模式后，工具界面会变为浅色。游戏测试区域的颜色保持不变。',
            'Save': '保存',
            'Settings saved.': '已保存设置。',
            'Auto Generate': '自动生成',
            'Stop': '中断',
            'Auto generation failed: %1': '自动生成失败：%1',
            'Auto generation finished. %1 puyos were added.': '自动生成完成。已添加 %1 个气泡。',
            'Auto generation stopped.': '已中断自动生成。',
            'Looking for a layout that reaches the goal on the first turn...': '正在寻找能在第一回合达成目标的布局…',
            'Could not find a layout that reaches the goal. Try changing the goal or the puyos already placed.': '未能找到可以达成目标的布局。请尝试更改目标或已放置的气泡。',
            'Looking for a layout that makes exactly %1 chains...': '正在寻找正好形成 %1 连锁的布局…',
            'Could not find a layout that makes exactly %1 chains. Try changing the colors in use or the puyos already placed.': '未能找到正好形成 %1 连锁的布局。请尝试更改使用的颜色列表或已放置的气泡。',
            'This browser cannot run the background search.': '此浏览器无法运行后台搜索。',
            'The puyos already on the play field pop on their own.': '游戏区域中已放置的气泡会自行消除。',
            'The puyos already on the play field make more chains than the target.': '游戏区域中已放置的气泡形成的连锁多于目标。',
            'The background search stopped with an error.': '后台搜索因错误而停止。',
            'The settings were applied but could not be saved.': '设置已应用，但未能保存。',
            'combo (chain)': 'combo（连锁）',
            'Win when the target chain count is reached.': '达到目标连锁数即为成功。',
            'clear (all clear)': 'clear（全清）',
            'Win on an all clear. The condition value is not used.': '全清即为成功。不使用目标类型数值。',
            'multiple (puyos popped at once)': 'multiple（同时消除数）',
            'Win when the puyos popped at once in one chain reach the target count.': '一次连锁中同时消除的气泡数达到目标即为成功。',
            'color (colors popped at once)': 'color（同时消除的颜色数）',
            'Win when the colors popped at once in one chain reach the target count. Garbage puyos are excluded.': '一次连锁中同时消除的颜色数达到目标即为成功。不含干扰气泡。',
            'attack (attack amount)': 'attack（攻击量）',
            'Win when ATTACK plus DAMAGE momentarily reaches the target count.': 'ATTACK 与 DAMAGE 之和瞬间达到目标即为成功。',
            'red': '红',
            'green': '绿',
            'yellow': '黄',
            'blue': '蓝',
            'purple': '紫',
            'puyow.js must be loaded first.': '需要先载入 puyow.js。',
            'This puyow.js build has no dev tools API.': '此 puyow.js 版本没有开发工具 API。',
            'Enter the script to load.': '请输入要载入的脚本。',
            'The script could not be parsed. (%1)': '无法解析脚本。（%1）',
            'Not a FeverStageState or PuzzlePuyoStage object.': '不是 FeverStageState 或 PuzzlePuyoStage 对象。',
            'The editor is not ready.': '编辑画面尚未就绪。',
            'Place at least one puyo on the play field.': '请在游戏区域放置至少一个气泡。',
            'Enter %1.': '请输入%1。',
            '%1 must be an integer.': '%1 必须是整数。',
            'Target chain must be from %1 to %2.': '目标连锁数必须是 %1 ~ %2。',
            'Difficulty must be an integer of 1 or more.': '难度必须是 1 以上的整数。',
            'The colors in use must have %1 to %2 colors.': '使用的颜色列表须有 %1 ~ %2 种颜色。',
            'The colors in use contain "%1" more than once.': '使用的颜色列表中 "%1" 出现了不止一次。',
            'Fill both cells of the next puyos.': '请填满“下一个气泡”的两个格子。',
            'The color "%1" on the play field is not in the colors in use.': '游戏区域的颜色 "%1" 不在使用的颜色列表中。',
            'The color "%1" of the next puyos is not in the colors in use.': '“下一个气泡”的颜色 "%1" 不在使用的颜色列表中。',
            'One cell of turn %1 of the next puyos is empty.': '“下一个气泡”第 %1 回合有一个格子是空的。',
            'There is an empty turn before turn %1 of the next puyos.': '“下一个气泡”第 %1 回合之前有空的回合。',
            'Fill the next puyos for all %1 turns of the turn limit.': '请把“下一个气泡”按目标回合数 %1 回合全部填满。',
            'Choose a win condition.': '请选择目标类型。',
            'The condition value must be an integer of 1 or more.': '目标类型数值必须是 1 以上的整数。',
            'The turn limit must be from %1 to %2.': '目标回合数必须是 %1 ~ %2。',
            'Could not find the element to build the dev tools in.': '找不到用于放置开发工具的元素。'
        },
        de: {
            'Puyo W Dev Tools': 'Puyo W Entwicklerwerkzeuge',
            'Edit FEVER Pattern': 'FEVER-Muster bearbeiten',
            'Edit Puzzle Puyo': 'Puzzle-Puyo bearbeiten',
            'Choose what to develop.': 'Wähle aus, was du entwickeln willst.',
            'Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.': 'Wähle oben am Bildschirm „Puzzle-Puyo bearbeiten“ oder „FEVER-Muster bearbeiten“.',
            'Use a screen that is wider than it is tall.': 'Verwende einen Bildschirm, der breiter als hoch ist.',
            'Editing a FEVER pattern.': 'Ein FEVER-Muster wird bearbeitet.',
            'Editing a Puzzle Puyo stage.': 'Eine Puzzle-Puyo-Stage wird bearbeitet.',
            'Choose again after the test finishes.': 'Wähle erneut, sobald der Test beendet ist.',
            'Existing data loaded.': 'Vorhandene Daten geladen.',
            'Existing pattern loaded.': 'Vorhandenes Muster geladen.',
            'Load failed: %1': 'Laden fehlgeschlagen: %1',
            'Script generated.': 'Skript erzeugt.',
            'Script generation failed: %1': 'Skripterzeugung fehlgeschlagen: %1',
            'Test failed: %1': 'Test fehlgeschlagen: %1',
            'FEVER test in progress. Play with the keyboard. (ESC: pause)': 'FEVER-Test läuft. Spiele mit der Tastatur. (ESC: Pause)',
            'Puzzle Puyo test in progress. Play with the keyboard. (ESC: pause)': 'Puzzle-Puyo-Test läuft. Spiele mit der Tastatur. (ESC: Pause)',
            'Test succeeded. You can now generate the script.': 'Test bestanden. Du kannst jetzt das Skript erzeugen.',
            'Test failed: the first supplied pair made %1 chains, but exactly %2 chains are required.': 'Test fehlgeschlagen: Das erste ausgegebene Paar ergab %1 Ketten, nötig sind genau %2.',
            'Test failed: the goal was not reached.': 'Test fehlgeschlagen: Das Ziel wurde nicht erreicht.',
            'Test failed: the goal was reached on turn %1, but the turn limit is %2.': 'Test fehlgeschlagen: Das Ziel wurde in Zug %1 erreicht, das Zuglimit ist aber %2.',
            'Test failed: the chain was %1, but exactly %2 chains are required.': 'Test fehlgeschlagen: Es waren %1 Ketten, nötig sind genau %2.',
            'Run a successful test before generating the script.': 'Bestehe erst einen Test, bevor du das Skript erzeugst.',
            'The data changed after the test. Run the test again before generating the script.': 'Die Daten haben sich nach dem Test geändert. Teste erneut, bevor du das Skript erzeugst.',
            'You can add up to %1 colors.': 'Du kannst bis zu %1 Farben hinzufügen.',
            'Load': 'Laden',
            'Script': 'Skript',
            'Existing Patterns': 'Vorhandene Muster',
            'FEVER Pattern': 'FEVER-Muster',
            'Target Chain': 'Zielkette',
            'Difficulty': 'Schwierigkeit',
            'Target chain is an integer from %1 to %2, and difficulty an integer of 1 or more.': 'Die Zielkette ist eine ganze Zahl von %1 bis %2, die Schwierigkeit eine ganze Zahl ab 1.',
            'Colors In Use': 'Verwendete Farben',
            'No.': 'Nr.',
            'Color': 'Farbe',
            'Delete': 'Löschen',
            'Add Color': 'Farbe hinzufügen',
            'Only red, blue, green, yellow and purple can be chosen. Use %1 to %2 colors, and do not add the same color twice.': 'Nur red, blue, green, yellow und purple sind wählbar. Verwende %1 bis %2 Farben und füge keine Farbe doppelt hinzu.',
            'Controls': 'Steuerung',
            'Test': 'Testen',
            'Generate Script': 'Skript erzeugen',
            'Pick a puyo from the palette at the right of the canvas, then click or drag on the left play field and on the "Next Puyos" cells in the middle.': 'Wähle ein Puyo aus der Palette rechts der Zeichenfläche und klicke oder ziehe dann im linken Spielfeld und auf den Feldern „Nächste Puyos“ in der Mitte.',
            'Puzzle Puyo': 'Puzzle-Puyo',
            'Win Condition': 'Zieltyp',
            'Condition Value': 'Zielwert',
            'Turn Limit': 'Zuglimit',
            'Hint': 'Hinweis',
            'Turn limit is an integer from %1 to %2, and the next puyos must be filled for at least that many turns. The hint may be left empty.': 'Das Zuglimit ist eine ganze Zahl von %1 bis %2, und die nächsten Puyos müssen für mindestens so viele Züge gefüllt sein. Der Hinweis darf leer bleiben.',
            'Generated Script': 'Erzeugtes Skript',
            'Load Script': 'Skript laden',
            'Load Existing Pattern': 'Vorhandenes Muster laden',
            'Choose a pattern to load into the editor.': 'Wähle ein Muster, das in den Editor geladen werden soll.',
            'There is no pattern to load.': 'Es gibt kein Muster zum Laden.',
            'Paste a script written as new FeverStageState(...) or new PuzzlePuyoStage({...}).': 'Füge ein Skript in der Form new FeverStageState(...) oder new PuzzlePuyoStage({...}) ein.',
            'OK': 'OK',
            'Cancel': 'Abbrechen',
            'Settings': 'Einstellungen',
            'Use Dark Mode': 'Dunkles Design verwenden',
            'Turning dark mode off lightens the tool screen. The game test area keeps its own colors.': 'Ohne dunkles Design wird die Werkzeugoberfläche hell. Der Spiel-Testbereich behält seine Farben.',
            'Save': 'Speichern',
            'Settings saved.': 'Einstellungen gespeichert.',
            'Auto Generate': 'Automatisch erzeugen',
            'Stop': 'Abbrechen',
            'Auto generation failed: %1': 'Automatische Erzeugung fehlgeschlagen: %1',
            'Auto generation finished. %1 puyos were added.': 'Automatische Erzeugung fertig. %1 Puyos wurden hinzugefügt.',
            'Auto generation stopped.': 'Automatische Erzeugung abgebrochen.',
            'Looking for a layout that reaches the goal on the first turn...': 'Suche nach einer Anordnung, die das Ziel im ersten Zug erreicht …',
            'Could not find a layout that reaches the goal. Try changing the goal or the puyos already placed.': 'Es wurde keine Anordnung gefunden, die das Ziel erreicht. Ändere das Ziel oder die bereits gesetzten Puyos.',
            'Looking for a layout that makes exactly %1 chains...': 'Suche nach einer Anordnung mit genau %1 Ketten …',
            'Could not find a layout that makes exactly %1 chains. Try changing the colors in use or the puyos already placed.': 'Es wurde keine Anordnung mit genau %1 Ketten gefunden. Ändere die verwendeten Farben oder die bereits gesetzten Puyos.',
            'This browser cannot run the background search.': 'Dieser Browser kann die Hintergrundsuche nicht ausführen.',
            'The puyos already on the play field pop on their own.': 'Die bereits gesetzten Puyos auf dem Spielfeld platzen von selbst.',
            'The puyos already on the play field make more chains than the target.': 'Die bereits gesetzten Puyos auf dem Spielfeld erzeugen mehr Ketten als das Ziel.',
            'The background search stopped with an error.': 'Die Hintergrundsuche wurde durch einen Fehler beendet.',
            'The settings were applied but could not be saved.': 'Die Einstellungen wurden übernommen, konnten aber nicht gespeichert werden.',
            'combo (chain)': 'combo (Kette)',
            'Win when the target chain count is reached.': 'Gewonnen, sobald die Zielkettenzahl erreicht ist.',
            'clear (all clear)': 'clear (alles weg)',
            'Win on an all clear. The condition value is not used.': 'Gewonnen bei einem All Clear. Der Zielwert wird nicht verwendet.',
            'multiple (puyos popped at once)': 'multiple (gleichzeitig geplatzte Puyos)',
            'Win when the puyos popped at once in one chain reach the target count.': 'Gewonnen, wenn die in einer Kette gleichzeitig geplatzten Puyos den Zielwert erreichen.',
            'color (colors popped at once)': 'color (gleichzeitig geplatzte Farben)',
            'Win when the colors popped at once in one chain reach the target count. Garbage puyos are excluded.': 'Gewonnen, wenn die in einer Kette gleichzeitig geplatzten Farben den Zielwert erreichen. Müll-Puyos zählen nicht.',
            'attack (attack amount)': 'attack (Angriffsmenge)',
            'Win when ATTACK plus DAMAGE momentarily reaches the target count.': 'Gewonnen, wenn ATTACK plus DAMAGE kurzzeitig den Zielwert erreicht.',
            'red': 'Rot',
            'green': 'Grün',
            'yellow': 'Gelb',
            'blue': 'Blau',
            'purple': 'Lila',
            'puyow.js must be loaded first.': 'puyow.js muss zuerst geladen werden.',
            'This puyow.js build has no dev tools API.': 'Dieser puyow.js-Build hat keine Entwicklerwerkzeug-API.',
            'Enter the script to load.': 'Gib das zu ladende Skript ein.',
            'The script could not be parsed. (%1)': 'Das Skript konnte nicht gelesen werden. (%1)',
            'Not a FeverStageState or PuzzlePuyoStage object.': 'Kein FeverStageState- oder PuzzlePuyoStage-Objekt.',
            'The editor is not ready.': 'Der Editor ist nicht bereit.',
            'Place at least one puyo on the play field.': 'Setze mindestens ein Puyo auf das Spielfeld.',
            'Enter %1.': 'Gib %1 ein.',
            '%1 must be an integer.': '%1 muss eine ganze Zahl sein.',
            'Target chain must be from %1 to %2.': 'Die Zielkette muss von %1 bis %2 reichen.',
            'Difficulty must be an integer of 1 or more.': 'Die Schwierigkeit muss eine ganze Zahl ab 1 sein.',
            'The colors in use must have %1 to %2 colors.': 'Die verwendeten Farben müssen %1 bis %2 Farben umfassen.',
            'The colors in use contain "%1" more than once.': 'Die verwendeten Farben enthalten „%1“ mehr als einmal.',
            'Fill both cells of the next puyos.': 'Fülle beide Felder der nächsten Puyos.',
            'The color "%1" on the play field is not in the colors in use.': 'Die Farbe „%1“ auf dem Spielfeld steht nicht in den verwendeten Farben.',
            'The color "%1" of the next puyos is not in the colors in use.': 'Die Farbe „%1“ der nächsten Puyos steht nicht in den verwendeten Farben.',
            'One cell of turn %1 of the next puyos is empty.': 'Ein Feld von Zug %1 der nächsten Puyos ist leer.',
            'There is an empty turn before turn %1 of the next puyos.': 'Vor Zug %1 der nächsten Puyos gibt es einen leeren Zug.',
            'Fill the next puyos for all %1 turns of the turn limit.': 'Fülle die nächsten Puyos für alle %1 Züge des Zuglimits.',
            'Choose a win condition.': 'Wähle einen Zieltyp.',
            'The condition value must be an integer of 1 or more.': 'Der Zielwert muss eine ganze Zahl ab 1 sein.',
            'The turn limit must be from %1 to %2.': 'Das Zuglimit muss von %1 bis %2 reichen.',
            'Could not find the element to build the dev tools in.': 'Das Element für die Entwicklerwerkzeuge wurde nicht gefunden.'
        },
        fr: {
            'Puyo W Dev Tools': 'Outils de développement Puyo W',
            'Edit FEVER Pattern': 'Créer un motif FEVER',
            'Edit Puzzle Puyo': 'Créer un Puyo puzzle',
            'Choose what to develop.': 'Choisis ce que tu veux créer.',
            'Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.': 'Choisis « Créer un Puyo puzzle » ou « Créer un motif FEVER » en haut de l’écran.',
            'Use a screen that is wider than it is tall.': 'Utilise un écran plus large que haut.',
            'Editing a FEVER pattern.': 'Édition d’un motif FEVER.',
            'Editing a Puzzle Puyo stage.': 'Édition d’un niveau de Puyo puzzle.',
            'Choose again after the test finishes.': 'Choisis de nouveau une fois le test terminé.',
            'Existing data loaded.': 'Données existantes chargées.',
            'Existing pattern loaded.': 'Motif existant chargé.',
            'Load failed: %1': 'Échec du chargement : %1',
            'Script generated.': 'Script généré.',
            'Script generation failed: %1': 'Échec de la génération du script : %1',
            'Test failed: %1': 'Échec du test : %1',
            'FEVER test in progress. Play with the keyboard. (ESC: pause)': 'Test FEVER en cours. Joue au clavier. (ESC : pause)',
            'Puzzle Puyo test in progress. Play with the keyboard. (ESC: pause)': 'Test de Puyo puzzle en cours. Joue au clavier. (ESC : pause)',
            'Test succeeded. You can now generate the script.': 'Test réussi. Tu peux maintenant générer le script.',
            'Test failed: the first supplied pair made %1 chains, but exactly %2 chains are required.': 'Échec du test : la première paire donnée a fait %1 chaînes, alors qu’il en faut exactement %2.',
            'Test failed: the goal was not reached.': 'Échec du test : l’objectif n’a pas été atteint.',
            'Test failed: the goal was reached on turn %1, but the turn limit is %2.': 'Échec du test : l’objectif a été atteint au tour %1, alors que la limite est de %2.',
            'Test failed: the chain was %1, but exactly %2 chains are required.': 'Échec du test : il y a eu %1 chaînes, alors qu’il en faut exactement %2.',
            'Run a successful test before generating the script.': 'Réussis d’abord un test avant de générer le script.',
            'The data changed after the test. Run the test again before generating the script.': 'Les données ont changé après le test. Refais le test avant de générer le script.',
            'You can add up to %1 colors.': 'Tu peux ajouter jusqu’à %1 couleurs.',
            'Load': 'Charger',
            'Script': 'Script',
            'Existing Patterns': 'Motifs existants',
            'FEVER Pattern': 'Motif FEVER',
            'Target Chain': 'Chaîne visée',
            'Difficulty': 'Difficulté',
            'Target chain is an integer from %1 to %2, and difficulty an integer of 1 or more.': 'La chaîne visée est un entier de %1 à %2, et la difficulté un entier supérieur ou égal à 1.',
            'Colors In Use': 'Couleurs utilisées',
            'No.': 'N°',
            'Color': 'Couleur',
            'Delete': 'Supprimer',
            'Add Color': 'Ajouter une couleur',
            'Only red, blue, green, yellow and purple can be chosen. Use %1 to %2 colors, and do not add the same color twice.': 'Seuls red, blue, green, yellow et purple sont possibles. Utilise de %1 à %2 couleurs, sans ajouter deux fois la même.',
            'Controls': 'Commandes',
            'Test': 'Tester',
            'Generate Script': 'Générer le script',
            'Pick a puyo from the palette at the right of the canvas, then click or drag on the left play field and on the "Next Puyos" cells in the middle.': 'Choisis un puyo dans la palette à droite du canevas, puis clique ou fais glisser sur le terrain de gauche et sur les cases « Puyos suivants » au centre.',
            'Puzzle Puyo': 'Puyo puzzle',
            'Win Condition': 'Type d’objectif',
            'Condition Value': 'Valeur de l’objectif',
            'Turn Limit': 'Nombre de tours',
            'Hint': 'Indice',
            'Turn limit is an integer from %1 to %2, and the next puyos must be filled for at least that many turns. The hint may be left empty.': 'Le nombre de tours est un entier de %1 à %2, et les puyos suivants doivent être remplis pour au moins autant de tours. L’indice peut rester vide.',
            'Generated Script': 'Script généré',
            'Load Script': 'Charger un script',
            'Load Existing Pattern': 'Charger un motif existant',
            'Choose a pattern to load into the editor.': 'Choisis un motif à charger dans l’éditeur.',
            'There is no pattern to load.': 'Aucun motif à charger.',
            'Paste a script written as new FeverStageState(...) or new PuzzlePuyoStage({...}).': 'Colle un script écrit sous la forme new FeverStageState(...) ou new PuzzlePuyoStage({...}).',
            'OK': 'OK',
            'Cancel': 'Annuler',
            'Settings': 'Réglages',
            'Use Dark Mode': 'Utiliser le thème sombre',
            'Turning dark mode off lightens the tool screen. The game test area keeps its own colors.': 'Sans le thème sombre, l’écran des outils s’éclaircit. La zone de test du jeu garde ses couleurs.',
            'Save': 'Enregistrer',
            'Settings saved.': 'Réglages enregistrés.',
            'Auto Generate': 'Génération auto',
            'Stop': 'Arrêter',
            'Auto generation failed: %1': 'Échec de la génération auto : %1',
            'Auto generation finished. %1 puyos were added.': 'Génération auto terminée. %1 puyos ont été ajoutés.',
            'Auto generation stopped.': 'Génération auto arrêtée.',
            'Looking for a layout that reaches the goal on the first turn...': 'Recherche d’une disposition qui atteint l’objectif au premier tour…',
            'Could not find a layout that reaches the goal. Try changing the goal or the puyos already placed.': 'Aucune disposition atteignant l’objectif n’a été trouvée. Essaie de changer l’objectif ou les puyos déjà placés.',
            'Looking for a layout that makes exactly %1 chains...': 'Recherche d’une disposition donnant exactement %1 chaînes…',
            'Could not find a layout that makes exactly %1 chains. Try changing the colors in use or the puyos already placed.': 'Aucune disposition donnant exactement %1 chaînes n’a été trouvée. Essaie de changer les couleurs utilisées ou les puyos déjà placés.',
            'This browser cannot run the background search.': 'Ce navigateur ne peut pas lancer la recherche en arrière-plan.',
            'The puyos already on the play field pop on their own.': 'Les puyos déjà posés sur le terrain éclatent d’eux-mêmes.',
            'The puyos already on the play field make more chains than the target.': 'Les puyos déjà posés sur le terrain font plus de chaînes que l’objectif.',
            'The background search stopped with an error.': 'La recherche en arrière-plan s’est arrêtée sur une erreur.',
            'The settings were applied but could not be saved.': 'Les réglages ont été appliqués mais n’ont pas pu être enregistrés.',
            'combo (chain)': 'combo (chaîne)',
            'Win when the target chain count is reached.': 'Gagné lorsque le nombre de chaînes visé est atteint.',
            'clear (all clear)': 'clear (terrain vidé)',
            'Win on an all clear. The condition value is not used.': 'Gagné en vidant le terrain. La valeur de l’objectif n’est pas utilisée.',
            'multiple (puyos popped at once)': 'multiple (puyos éclatés d’un coup)',
            'Win when the puyos popped at once in one chain reach the target count.': 'Gagné lorsque les puyos éclatés d’un coup dans une chaîne atteignent le nombre visé.',
            'color (colors popped at once)': 'color (couleurs éclatées d’un coup)',
            'Win when the colors popped at once in one chain reach the target count. Garbage puyos are excluded.': 'Gagné lorsque les couleurs éclatées d’un coup dans une chaîne atteignent le nombre visé. Les puyos parasites ne comptent pas.',
            'attack (attack amount)': 'attack (quantité d’attaque)',
            'Win when ATTACK plus DAMAGE momentarily reaches the target count.': 'Gagné lorsque ATTACK plus DAMAGE atteint momentanément la valeur visée.',
            'red': 'rouge',
            'green': 'vert',
            'yellow': 'jaune',
            'blue': 'bleu',
            'purple': 'violet',
            'puyow.js must be loaded first.': 'puyow.js doit être chargé d’abord.',
            'This puyow.js build has no dev tools API.': 'Cette version de puyow.js n’a pas d’API d’outils de développement.',
            'Enter the script to load.': 'Saisis le script à charger.',
            'The script could not be parsed. (%1)': 'Le script n’a pas pu être analysé. (%1)',
            'Not a FeverStageState or PuzzlePuyoStage object.': 'Ce n’est ni un objet FeverStageState ni un objet PuzzlePuyoStage.',
            'The editor is not ready.': 'L’éditeur n’est pas prêt.',
            'Place at least one puyo on the play field.': 'Place au moins un puyo sur le terrain.',
            'Enter %1.': 'Saisis %1.',
            '%1 must be an integer.': '%1 doit être un entier.',
            'Target chain must be from %1 to %2.': 'La chaîne visée doit aller de %1 à %2.',
            'Difficulty must be an integer of 1 or more.': 'La difficulté doit être un entier supérieur ou égal à 1.',
            'The colors in use must have %1 to %2 colors.': 'Les couleurs utilisées doivent compter de %1 à %2 couleurs.',
            'The colors in use contain "%1" more than once.': 'Les couleurs utilisées contiennent « %1 » plus d’une fois.',
            'Fill both cells of the next puyos.': 'Remplis les deux cases des puyos suivants.',
            'The color "%1" on the play field is not in the colors in use.': 'La couleur « %1 » du terrain ne figure pas dans les couleurs utilisées.',
            'The color "%1" of the next puyos is not in the colors in use.': 'La couleur « %1 » des puyos suivants ne figure pas dans les couleurs utilisées.',
            'One cell of turn %1 of the next puyos is empty.': 'Une case du tour %1 des puyos suivants est vide.',
            'There is an empty turn before turn %1 of the next puyos.': 'Il y a un tour vide avant le tour %1 des puyos suivants.',
            'Fill the next puyos for all %1 turns of the turn limit.': 'Remplis les puyos suivants pour les %1 tours de la limite.',
            'Choose a win condition.': 'Choisis un type d’objectif.',
            'The condition value must be an integer of 1 or more.': 'La valeur de l’objectif doit être un entier supérieur ou égal à 1.',
            'The turn limit must be from %1 to %2.': 'Le nombre de tours doit aller de %1 à %2.',
            'Could not find the element to build the dev tools in.': 'Impossible de trouver l’élément où placer les outils de développement.'
        }
    };

    /**
     * 편집 화면 canvas는 puyow.js가 그리므로, 도구에서만 쓰는 canvas 문구의 번역은
     * `registerLanguage()`로 게임 번역표에 넣어 준다. 번역 정보 자체는 이 파일이 갖는다.
     * puyow.js의 번역 키는 한국어 원문이므로 여기서도 한국어를 키로 쓰며, 게임이 가진
     * 언어(en·ja·zh·de·fr)마다 도구 canvas 문구의 번역을 둔다.
     * @type {Object<string, Object<string,string>>}
     */
    const TOOLS_CANVAS_STRINGS = {
        en: {
            '다음에 나올 뿌요': 'Next Puyos',
            '%1턴': 'T%1',
            '다음에 나올 뿌요에는 색 뿌요만 넣을 수 있습니다.': 'Only color puyos can be placed in the next puyos.',
            '도구 편집 모드에서만 테스트할 수 있습니다.': 'Testing is only available in the dev tools editor.'
        },
        ja: {
            '다음에 나올 뿌요': 'NEXTぷよ',
            '%1턴': '%1手',
            '다음에 나올 뿌요에는 색 뿌요만 넣을 수 있습니다.': 'NEXTぷよには色ぷよしか置けません。',
            '도구 편집 모드에서만 테스트할 수 있습니다.': '開発ツールの編集モードでのみテストできます。'
        },
        zh: {
            '다음에 나올 뿌요': '下一个气泡',
            '%1턴': '第%1回合',
            '다음에 나올 뿌요에는 색 뿌요만 넣을 수 있습니다.': '“下一个气泡”只能放彩色气泡。',
            '도구 편집 모드에서만 테스트할 수 있습니다.': '只能在开发工具的编辑模式下测试。'
        },
        de: {
            '다음에 나올 뿌요': 'Nächste Puyos',
            '%1턴': 'Z%1',
            '다음에 나올 뿌요에는 색 뿌요만 넣을 수 있습니다.': 'In die nächsten Puyos passen nur Farb-Puyos.',
            '도구 편집 모드에서만 테스트할 수 있습니다.': 'Testen ist nur im Editor der Entwicklerwerkzeuge möglich.'
        },
        fr: {
            '다음에 나올 뿌요': 'Puyos suivants',
            '%1턴': 'T%1',
            '다음에 나올 뿌요에는 색 뿌요만 넣을 수 있습니다.': 'Seuls des puyos de couleur peuvent aller dans les puyos suivants.',
            '도구 편집 모드에서만 테스트할 수 있습니다.': 'Le test n’est possible que dans l’éditeur des outils de développement.'
        }
    };

    /** 도구 화면이 쓸 언어 코드다. 지원하지 않는 언어면 기본 언어인 영어를 쓴다. @type {string} */
    let toolsLanguage = 'en';

    /** 편집에 쓸 수 있는 일반 뿌요 색 목록이다. puyow.js의 COLORS와 같은 순서를 유지한다. @type {string[]} */
    const COLORS = ['red', 'green', 'yellow', 'blue', 'purple'];

    /** 색상 선택 칸 옆에 표시할 미리보기 색이다. @type {Object<string,string>} */
    const COLOR_SAMPLES = { red: '#ef5350', green: '#66bb6a', yellow: '#f7c843', blue: '#42a5f5', purple: '#ab73e8' };

    /** 퍼즐뿌요의 승리 조건 유형 목록이다. label과 description은 번역 키다. @type {{value:string, label:string, description:string}[]} */
    const WIN_CONDITION_TYPES = [
        { value: 'combo', label: 'combo (chain)', description: 'Win when the target chain count is reached.' },
        { value: 'clear', label: 'clear (all clear)', description: 'Win on an all clear. The condition value is not used.' },
        { value: 'multiple', label: 'multiple (puyos popped at once)', description: 'Win when the puyos popped at once in one chain reach the target count.' },
        { value: 'color', label: 'color (colors popped at once)', description: 'Win when the colors popped at once in one chain reach the target count. Garbage puyos are excluded.' },
        { value: 'attack', label: 'attack (attack amount)', description: 'Win when ATTACK plus DAMAGE momentarily reaches the target count.' }
    ];

    /** 피버 패턴 개발 화면에 처음 세팅해 둘 사용 색상 목록(3색)이다. @type {string[]} */
    const DEFAULT_FEVER_USING_COLORS = ['red', 'green', 'blue'];

    /** 피버 패턴에서 받을 수 있는 목표 연쇄 수의 최솟값이다. @type {number} */
    const FEVER_TARGET_COMBO_MIN = 4;

    /** 피버 패턴에서 받을 수 있는 목표 연쇄 수의 최댓값이다. @type {number} */
    const FEVER_TARGET_COMBO_MAX = 12;

    /** 피버 패턴의 "사용할 색상 목록"에 있어야 하는 색 수의 최솟값이다. @type {number} */
    const FEVER_USING_COLOR_MIN = 3;

    /** 피버 패턴의 "사용할 색상 목록"에 있어야 하는 색 수의 최댓값이다. @type {number} */
    const FEVER_USING_COLOR_MAX = 5;

    /** 퍼즐뿌요에서 받을 수 있는 목표 턴수의 최솟값이다. @type {number} */
    const PUZZLE_TURN_LIMIT_MIN = 1;

    /** 퍼즐뿌요에서 받을 수 있는 목표 턴수의 최댓값이다. "다음에 나올 뿌요" 편집 칸 수와 같다. @type {number} */
    const PUZZLE_TURN_LIMIT_MAX = 6;


    /** 자동생성이 다룰 수 있는 편집 영역 크기다. puyow.js의 SIMULATOR_EDITABLE_ROWS와 같게 맞춘다. @type {{columns:number, rows:number}} */
    const AUTO_GENERATE_BOARD = Object.freeze({ columns: 6, rows: 13 });

    /** puyow.js 보드 배열의 전체 줄 수다. 검증용 보드를 만들 때 이 크기로 맞춘다. @type {number} */
    const GAME_BOARD_ROWS = 25;

    /** 자동생성 탐색 한 판에서 살펴볼 수 있는 최대 갈래 수다. @type {number} */
    const AUTO_GENERATE_BRANCH = 6;

    /** 자동생성 탐색 한 판의 시작 예산이다. 실패할 때마다 두 배로 늘린다. @type {number} */
    const AUTO_GENERATE_START_NODES = 120;

    /** 자동생성을 포기하기까지 기다리는 시간(ms)이다. @type {number} */
    const AUTO_GENERATE_TIME_LIMIT = 120000;

    /**
     * 직전과 같은 결과가 나왔을 때 다른 경우를 다시 찾아볼 최대 횟수다.
     * 해가 하나뿐인 조건도 있으므로 무한정 다시 찾지 않고 이 횟수까지만 시도한다.
     * @type {number}
     */
    const AUTO_GENERATE_VARIETY_RETRIES = 8;

    /** 직전 자동생성 결과의 지문이다. 같은 결과가 또 나오면 다른 경우를 더 찾아본다. @type {string|null} */
    let autoGenerateLastSignature = null;

    /** 지금 자동생성에서 같은 결과를 피하려고 다시 찾은 횟수다. @type {number} */
    let autoGenerateVarietyRetries = 0;

    /** 지금 돌고 있는 자동생성 Worker다. 진행 중이 아니면 null이다. @type {Worker|null} */
    let generateWorker = null;

    /** 지금 돌고 있는 자동생성 Worker의 Blob URL이다. Worker를 끝낼 때 함께 없앤다. @type {string|null} */
    let generateWorkerUrl = null;

    /**
     * 자동생성이 끝나기를 기다리는 요청들의 완료 함수 목록이다.
     * WebMCP 도구는 결과 문구를 돌려줘야 하므로 여기에 자기 완료 함수를 넣어 두고 기다린다.
     * @type {((message:string) => void)[]}
     */
    let autoGenerateWaiters = [];

    /**
     * 자동생성 결과를 화면에 알리고, 결과를 기다리던 요청들을 모두 깨운다.
     * @param {string} message 표시할 문구
     * @param {'info'|'done'|'error'} level 문구 종류
     * @returns {void}
     */
    function finishAutoGenerate(message, level) {
        setStatus(message, level);
        const waiters = autoGenerateWaiters;
        autoGenerateWaiters = [];
        waiters.forEach((resolve) => resolve(message));
    }

    /**
     * 자동생성 탐색에 쓸 시작 난수 씨앗을 만든다.
     * 이 값이 매번 달라야 조건을 만족하는 여러 배치 가운데 다른 것이 나온다.
     * Math.random()을 직접 부르지 않고 게임의 randomFloat()를 거치는 것은 puyow.js와 같은 계약을 지키기 위해서다.
     * @returns {number} 0 이상 2^31 미만의 정수
     */
    function createAutoGenerateSeed() {
        return Math.floor(getGameApi().randomFloat() * 0x7fffffff);
    }

    /**
     * 자동생성 결과를 서로 비교하기 위한 지문을 만든다.
     * 놓인 자리와 색이 모두 같을 때만 같은 지문이 된다.
     * @param {{x:number,y:number,color:string}[]} puyos 자동생성이 돌려준 배치
     * @returns {string} 배치 지문
     */
    function buildAutoGenerateSignature(puyos) {
        return puyos.map(({ x, y, color }) => `${x},${y},${color}`).sort().join('|');
    }

    /**
     * 방금 찾은 배치가 직전 결과와 똑같으면 Worker에게 다른 경우를 더 찾게 한다.
     * 사용자가 마음에 들 때까지 자동생성을 눌러 볼 수 있도록 되도록 다른 결과를 내주려는 것이며,
     * 해가 하나뿐인 조건에서 영원히 헤매지 않도록 정해 둔 횟수까지만 다시 찾는다.
     * @param {{x:number,y:number,color:string}[]} puyos 방금 찾은 배치
     * @param {Worker} worker 지금 돌고 있는 자동생성 Worker
     * @returns {boolean} 다시 찾도록 요청했는지 여부
     */
    function retryAutoGenerateForVariety(puyos, worker) {
        if (buildAutoGenerateSignature(puyos) !== autoGenerateLastSignature) return false;
        if (autoGenerateVarietyRetries >= AUTO_GENERATE_VARIETY_RETRIES) return false;
        autoGenerateVarietyRetries += 1;
        worker.postMessage({ type: 'reject' });
        return true;
    }

    /**
     * 자동생성 결과를 받아들이고, 다음 자동생성이 같은 결과를 피할 수 있도록 지문을 남긴다.
     * @param {{x:number,y:number,color:string}[]} puyos 받아들일 배치
     * @returns {void}
     */
    function acceptAutoGenerateResult(puyos) {
        autoGenerateLastSignature = buildAutoGenerateSignature(puyos);
        stopAutoGenerate();
        getToolsApi().setEditorData({ stageData: { puyos } });
    }

    /**
     * 도구 페이지 설정을 담는 localStorage 키다.
     * 게임 본체는 puyow_store를 쓰므로 이름이 겹치지 않도록 따로 둔다.
     * @type {string}
     */
    const TOOLS_SETTINGS_STORE_KEY = 'puyow_tools_settings';

    /** 도구 페이지 설정의 기본값이다. @type {{darkMode:boolean}} */
    const DEFAULT_TOOLS_SETTINGS = { darkMode: true };

    /** 지금 적용 중인 도구 페이지 설정이다. @type {{darkMode:boolean}} */
    let toolsSettings = { ...DEFAULT_TOOLS_SETTINGS };

    /**
     * localStorage에서 읽은 설정 원본이다.
     * 이 판이 아직 모르는 항목을 저장할 때 지우지 않으려고 그대로 갖고 있는다.
     * @type {object}
     */
    let toolsSettingsRaw = {};

    /** 도구 화면을 담은 최상위 요소다. 초기화 전에는 null이다. @type {HTMLElement|null} */
    let rootElement = null;

    /** 화면을 구성하는 주요 요소 모음이다. @type {Object<string, HTMLElement>} */
    const elements = {};

    /** 현재 선택한 개발 대상이다. 아직 고르지 않았으면 null이다. @type {'fever'|'puzzle'|null} */
    let currentMode = null;

    /** 게임 캔버스가 이미 초기화되었는지 여부다. @type {boolean} */
    let gameInitialized = false;

    /** 지금 테스트를 진행 중인지 여부다. @type {boolean} */
    let testing = false;

    /**
     * 테스트에 성공한 시점의 편집 내용 지문이다. 성공한 적이 없으면 null이다.
     * 스크립트 생성 직전에 현재 지문과 비교해, 달라졌으면 다시 테스트하도록 요구한다.
     * @type {string|null}
     */
    let verifiedSnapshot = null;

    /** 캔버스 영역 크기 변화를 감시하는 관찰자다. @type {ResizeObserver|null} */
    let canvasResizeObserver = null;

    /**
     * 도구 화면에 쓸 언어를 정한다. 도구 페이지는 한국어와 영어만 지원하므로
     * 브라우저 언어가 한국어일 때만 한국어를 쓰고, 나머지는 기본 언어인 영어를 쓴다.
     * @returns {'ko'|'en'} 사용할 언어 코드
     */
    function detectToolsLanguage() {
        // puyow.js가 게임 문구의 언어를 고르는 방식과 같게 앞 두 글자만 본다.
        // 두 판정이 어긋나면 사이드바와 편집 화면 canvas의 언어가 서로 달라진다.
        const code = String(navigator.language || navigator.userLanguage || '').trim().slice(0, 2).toLowerCase();
        return Object.prototype.hasOwnProperty.call(TOOLS_STRINGS, code) ? code : 'en';
    }

    /**
     * 도구 화면의 영어 원문을 현재 언어로 번역하고 %1, %2 형식의 인수를 채운다.
     * 기본 언어가 영어이므로 번역이 없으면 원문을 그대로 쓴다.
     * @param {string} text 영어 원문 키
     * @param {...(string|number)} values 치환할 값
     * @returns {string} 표시할 문구
     */
    function translate(text, ...values) {
        const localeTable = TOOLS_STRINGS[toolsLanguage] || {};
        const translated = localeTable[text] || text;
        return values.reduce((result, value, index) => result.replace(`%${index + 1}`, String(value)), translated);
    }

    /**
     * 편집 화면 canvas에서만 쓰는 문구의 영어 번역을 게임 번역표에 등록한다.
     * `registerLanguage()`는 초기화 전에만 부를 수 있으므로 게임을 만들기 전에 한 번 실행한다.
     * @returns {void}
     */
    function registerToolsCanvasLanguages() {
        const api = getGameApi();
        if (typeof api.registerLanguage !== 'function') return;
        Object.entries(TOOLS_CANVAS_STRINGS).forEach(([locale, entries]) => api.registerLanguage(locale, entries));
    }

    /** @returns {object} puyow.js가 내보낸 게임 API */
    function getGameApi() {
        const api = window.PuyoW || window.WebPuyo;
        if (!api) throw new Error(translate('puyow.js must be loaded first.'));
        return api;
    }

    /** @returns {object} puyow.js가 내보낸 개발용 도구 API */
    function getToolsApi() {
        const api = getGameApi().tools;
        if (!api) throw new Error(translate('This puyow.js build has no dev tools API.'));
        return api;
    }

    /**
     * 도구 화면에 필요한 CSS를 style 태그로 문서에 넣는다. 이미 넣었으면 아무것도 하지 않는다.
     * @returns {void}
     */
    function prepareStyle() {
        if (document.querySelector('style.puyow_tools_style')) return;
        const style = document.createElement('style');
        style.className = 'puyow_tools_style';
        style.textContent = `
            /*
                도구 화면의 색은 모두 아래 변수를 거친다. 설정 창에서 다크 모드를 끄면
                body에 puyow-tools-light 클래스가 붙어 밝은 톤 값으로 바뀐다.
                --tools-canvas-bg 는 게임이 직접 그리는 테스트 영역이라 밝은 톤에서도 그대로 둔다.
            */
            body.webpuyo {
                --tools-bg: #061019;
                --tools-fg: #d8f2f5;
                --tools-muted: #6f9cae;
                --tools-label: #a9d9e5;
                --tools-accent: #f7c843;
                --tools-error: #ff8a80;
                --tools-done: #7ee0c8;
                --tools-border: #1d4a60;
                --tools-toolbar-bg: #0c2433;
                --tools-sidebar-bg: #0a1d29;
                --tools-canvas-bg: #071621;
                --tools-grid-head-bg: #0f2c3b;
                --tools-input-bg: #061019;
                --tools-input-fg: #f5fbfc;
                --tools-input-border: #35637a;
                --tools-button-bg: #173747;
                --tools-button-fg: #f5fbfc;
                --tools-button-border: #497180;
                --tools-button-hover-bg: #1f4a5e;
                --tools-button-strong-bg: #2b6b57;
                --tools-button-active-border: #46d7c4;
                --tools-button-primary-border: #4cc9b0;
                --tools-button-danger-bg: #5a2a2a;
                --tools-button-danger-border: #ef5350;
                --tools-dialog-bg: #102c3b;
                --tools-dialog-border: #6ea2b8;
                --tools-dialog-backdrop: rgba(3, 11, 19, .78);
                --tools-sample-border: rgba(255, 255, 255, .35);
            }

            body.webpuyo.puyow-tools-light {
                --tools-bg: #f3f6f8;
                --tools-fg: #16303d;
                --tools-muted: #547486;
                --tools-label: #3d6376;
                --tools-accent: #8a5a00;
                --tools-error: #b3261e;
                --tools-done: #0f6d59;
                --tools-border: #a8c2ce;
                --tools-toolbar-bg: #dde8ee;
                --tools-sidebar-bg: #e9f0f4;
                --tools-grid-head-bg: #dbe7ed;
                --tools-input-bg: #ffffff;
                --tools-input-fg: #16303d;
                --tools-input-border: #7fa2b2;
                --tools-button-bg: #e6eef2;
                --tools-button-fg: #16303d;
                --tools-button-border: #7fa2b2;
                --tools-button-hover-bg: #d3e2ea;
                --tools-button-strong-bg: #bfe3d7;
                --tools-button-active-border: #2b8f78;
                --tools-button-primary-border: #2b8f78;
                --tools-button-danger-bg: #f6d9d8;
                --tools-button-danger-border: #c62828;
                --tools-dialog-bg: #ffffff;
                --tools-dialog-border: #7fa2b2;
                --tools-dialog-backdrop: rgba(20, 40, 52, .45);
                --tools-sample-border: rgba(0, 0, 0, .3);
            }

            body.webpuyo { margin: 0; background: var(--tools-bg); }

            .puyow-tools {
                background: var(--tools-bg);
                color: var(--tools-fg);
                display: flex;
                flex-direction: column;
                font-family: 'Nanum Gothic', 'Noto Sans KR', sans-serif;
                font-size: 14px;
                height: 100vh;
                overflow: hidden;
                width: 100%;
            }

            /* display 를 지정한 영역도 hidden 속성으로 감출 수 있게 한다. */
            .puyow-tools [hidden] { display: none !important; }

            .puyow-tools-toolbar {
                align-items: center;
                background: var(--tools-toolbar-bg);
                border-bottom: 2px solid var(--tools-border);
                display: flex;
                flex: 0 0 auto;
                gap: 10px;
                padding: 10px 16px;
            }

            .puyow-tools-toolbar h1 {
                font-size: 17px;
                font-weight: normal;
                margin: 0 14px 0 0;
                color: var(--tools-accent);
                white-space: nowrap;
            }

            .puyow-tools-status {
                flex: 1 1 auto;
                font-size: 13px;
                margin-left: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .puyow-tools-status.is-error { color: var(--tools-error); }
            .puyow-tools-status.is-done { color: var(--tools-done); }

            .puyow-tools button {
                background: var(--tools-button-bg);
                border: 2px solid var(--tools-button-border);
                border-radius: 4px;
                color: var(--tools-button-fg);
                cursor: pointer;
                font-family: inherit;
                font-size: 14px;
                padding: 7px 14px;
            }

            .puyow-tools button:hover:not(:disabled) { background: var(--tools-button-hover-bg); }
            .puyow-tools button:disabled { cursor: not-allowed; opacity: .45; }
            .puyow-tools button.is-active { background: var(--tools-button-strong-bg); border-color: var(--tools-button-active-border); }
            .puyow-tools button.is-primary { background: var(--tools-button-strong-bg); border-color: var(--tools-button-primary-border); }
            .puyow-tools button.is-danger { background: var(--tools-button-danger-bg); border-color: var(--tools-button-danger-border); }
            .puyow-tools button.is-small { font-size: 12px; padding: 3px 8px; }

            .puyow-tools-body {
                display: flex;
                flex: 1 1 auto;
                min-height: 0;
            }

            .puyow-tools-empty {
                align-items: center;
                color: var(--tools-muted);
                display: flex;
                flex: 1 1 auto;
                justify-content: center;
                text-align: center;
            }

            /* 좌측 사이드바와 우측 영역의 비율은 4 : 6 이다. */
            .puyow-tools-sidebar {
                background: var(--tools-sidebar-bg);
                border-right: 2px solid var(--tools-border);
                box-sizing: border-box;
                display: flex;
                flex: 4 1 0;
                flex-direction: column;
                gap: 14px;
                min-width: 0;
                overflow-y: auto;
                padding: 14px 16px;
            }

            .puyow-tools-right {
                box-sizing: border-box;
                display: flex;
                flex: 6 1 0;
                flex-direction: column;
                min-width: 0;
            }

            /* 우측 캔버스 영역과 스크립트 출력 영역의 비율은 7 : 3 이다. */
            .puyow-tools-canvas {
                align-items: center;
                background: var(--tools-canvas-bg);
                box-sizing: border-box;
                display: flex;
                flex: 7 1 0;
                justify-content: center;
                min-height: 0;
                overflow: hidden;
                padding: 8px;
            }

            .puyow-tools-output {
                border-top: 2px solid var(--tools-border);
                box-sizing: border-box;
                display: flex;
                flex: 3 1 0;
                flex-direction: column;
                min-height: 0;
                padding: 8px 10px 10px 10px;
            }

            .puyow-tools-output-title {
                color: var(--tools-label);
                flex: 0 0 auto;
                font-size: 13px;
                padding-bottom: 6px;
            }

            .puyow-tools-output textarea {
                background: var(--tools-input-bg);
                border: 2px solid var(--tools-border);
                border-radius: 4px;
                box-sizing: border-box;
                color: var(--tools-fg);
                flex: 1 1 auto;
                font-family: 'Nanum Gothic Coding', 'Noto Sans Mono', monospace;
                font-size: 12px;
                min-height: 0;
                padding: 8px;
                resize: none;
                white-space: pre;
                width: 100%;
            }

            .puyow-tools-section {
                border: 1px solid var(--tools-border);
                border-radius: 4px;
                padding: 10px 12px 12px 12px;
            }

            .puyow-tools-section > h2 {
                color: var(--tools-accent);
                font-size: 14px;
                font-weight: normal;
                margin: 0 0 10px 0;
            }

            .puyow-tools-field {
                align-items: center;
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
            }

            .puyow-tools-field:last-child { margin-bottom: 0; }

            .puyow-tools-field > label {
                color: var(--tools-label);
                flex: 0 0 96px;
                font-size: 13px;
            }

            .puyow-tools input[type="number"],
            .puyow-tools input[type="text"],
            .puyow-tools select,
            .puyow-tools textarea {
                background: var(--tools-input-bg);
                border: 2px solid var(--tools-input-border);
                border-radius: 3px;
                box-sizing: border-box;
                color: var(--tools-input-fg);
                font-family: inherit;
                font-size: 13px;
                padding: 5px 6px;
            }

            .puyow-tools input[type="number"] { width: 90px; }
            .puyow-tools input[type="text"] { flex: 1 1 auto; min-width: 0; }
            .puyow-tools select { flex: 1 1 auto; min-width: 0; }
            .puyow-tools input:disabled, .puyow-tools select:disabled { opacity: .4; }

            .puyow-tools-hint {
                color: var(--tools-muted);
                font-size: 12px;
                line-height: 1.5;
                margin-top: 6px;
            }

            .puyow-tools-grid {
                border-collapse: collapse;
                width: 100%;
            }

            .puyow-tools-grid th, .puyow-tools-grid td {
                border: 1px solid var(--tools-border);
                font-size: 13px;
                font-weight: normal;
                padding: 4px 6px;
                text-align: left;
            }

            .puyow-tools-grid th { background: var(--tools-grid-head-bg); color: var(--tools-label); }
            .puyow-tools-grid td.is-narrow { width: 1px; white-space: nowrap; }

            .puyow-tools-color-sample {
                border: 1px solid var(--tools-sample-border);
                border-radius: 50%;
                display: inline-block;
                height: 14px;
                vertical-align: middle;
                width: 14px;
            }

            .puyow-tools-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .puyow-tools-dialog {
                align-items: center;
                background: var(--tools-dialog-backdrop);
                display: flex;
                inset: 0;
                justify-content: center;
                position: fixed;
                z-index: 100;
            }

            .puyow-tools-dialog[hidden] { display: none; }

            .puyow-tools-dialog-panel {
                background: var(--tools-dialog-bg);
                border: 2px solid var(--tools-dialog-border);
                border-radius: 6px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 92vw;
                padding: 16px;
                width: 720px;
            }

            .puyow-tools-dialog-panel h2 {
                color: var(--tools-accent);
                font-size: 16px;
                font-weight: normal;
                margin: 0;
            }

            .puyow-tools-dialog-panel textarea {
                font-family: 'Nanum Gothic Coding', 'Noto Sans Mono', monospace;
                height: 260px;
                resize: vertical;
                width: 100%;
            }


            .puyow-tools-overlay {
                align-items: center;
                background: var(--tools-dialog-backdrop);
                display: flex;
                inset: 0;
                justify-content: center;
                position: fixed;
                z-index: 200;
            }

            .puyow-tools-overlay[hidden] { display: none; }

            .puyow-tools-overlay-panel {
                align-items: center;
                background: var(--tools-dialog-bg);
                border: 2px solid var(--tools-dialog-border);
                border-radius: 6px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 14px;
                max-width: 92vw;
                padding: 22px 24px;
                width: 380px;
            }

            /* 남은 시간을 알 수 없는 작업이라 진행률 대신 흐르는 막대만 보여 준다. */
            .puyow-tools-progress {
                background: var(--tools-input-bg);
                border: 1px solid var(--tools-border);
                border-radius: 3px;
                height: 10px;
                overflow: hidden;
                position: relative;
                width: 100%;
            }

            .puyow-tools-progress > span {
                animation: puyow-tools-indeterminate 1.2s linear infinite;
                background: var(--tools-button-active-border);
                display: block;
                height: 100%;
                left: -40%;
                position: absolute;
                width: 40%;
            }

            @keyframes puyow-tools-indeterminate {
                from { left: -40%; }
                to { left: 100%; }
            }

            .puyow-tools-overlay-text {
                color: var(--tools-fg);
                font-size: 13px;
                line-height: 1.6;
                text-align: center;
            }

            /* 패턴이 많으므로 목록만 팝업 안에서 스크롤한다. */
            .puyow-tools-pattern-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 50vh;
                overflow-y: auto;
            }

            .puyow-tools-pattern-item {
                align-items: baseline;
                display: flex;
                gap: 10px;
                text-align: left;
                width: 100%;
            }

            .puyow-tools-pattern-index {
                color: var(--tools-label);
                flex: 0 0 auto;
            }

            .puyow-tools-pattern-detail {
                flex: 1 1 auto;
                font-size: 13px;
                line-height: 1.5;
                word-break: break-word;
            }

            .puyow-tools-dialog-buttons {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }

            /* 설정 창은 불러오기 창보다 좁아도 충분하다. */
            .puyow-tools-dialog-panel.is-narrow { width: 420px; }

            .puyow-tools-dialog-panel.is-narrow .puyow-tools-field > label { flex: 1 1 auto; }

            .puyow-tools input[type="checkbox"] {
                flex: 0 0 auto;
                height: 16px;
                margin: 0;
                width: 16px;
            }

            /*
                puyow.js의 실행용 레이아웃은 게임 페이지 전체를 채우도록 100vw 기준으로 잡혀 있다.
                도구 화면에서는 캔버스 영역 안쪽에만 들어가야 하므로 크기를 여기서 다시 지정하고,
                실제 픽셀 크기는 16 : 9 비율을 지키도록 스크립트가 계산해 넣는다.
            */
            .puyow-tools-canvas .div_puyow_root {
                align-self: center;
                flex: 0 0 auto;
                height: auto;
                margin: 0;
                width: auto;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 지정한 태그의 요소를 만들어 옵션을 적용한다.
     * @param {string} tagName 태그 이름
     * @param {{className?:string, text?:string, attributes?:Object<string,string>}} [options] 적용할 옵션
     * @param {HTMLElement} [parent] 붙일 부모 요소
     * @returns {HTMLElement} 만들어진 요소
     */
    function createElement(tagName, options = {}, parent = null) {
        const element = document.createElement(tagName);
        if (options.className) element.className = options.className;
        if (options.text !== undefined) element.textContent = options.text;
        Object.entries(options.attributes || {}).forEach(([name, value]) => element.setAttribute(name, value));
        if (parent) parent.appendChild(element);
        return element;
    }

    /**
     * 사이드바에 한 줄짜리 입력 항목을 만든다.
     * @param {HTMLElement} parent 부모 요소
     * @param {string} labelText 항목 이름
     * @param {HTMLElement} field 입력 요소
     * @returns {HTMLElement} 만들어진 줄 요소
     */
    function appendField(parent, labelText, field) {
        const row = createElement('div', { className: 'puyow-tools-field' }, parent);
        createElement('label', { text: labelText }, row);
        row.appendChild(field);
        return row;
    }

    /**
     * 툴바 아래 상태 문구를 바꾼다.
     * @param {string} message 표시할 문구
     * @param {'info'|'error'|'done'} [level='info'] 문구 종류
     * @returns {void}
     */
    function setStatus(message, level = 'info') {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.classList.toggle('is-error', level === 'error');
        elements.status.classList.toggle('is-done', level === 'done');
    }

    /**
     * 입력 요소가 키보드 조작을 게임에 넘기지 않도록 막는다.
     * puyow.js는 window에서 키 입력을 받으므로, 입력 칸 안에서 누른 키는 여기서 전파를 끊는다.
     * @param {KeyboardEvent} event 키 이벤트
     * @returns {void}
     */
    function stopKeyEventForFormField(event) {
        const target = event.target;
        if (!target || typeof target.tagName !== 'string') return;
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
            event.stopPropagation();
        }
    }

    /**
     * 도구 화면의 기본 뼈대(툴바, 사이드바, 캔버스, 출력 영역)를 만든다.
     * @returns {void}
     */
    function buildLayout() {
        rootElement.classList.add('puyow-tools');
        rootElement.textContent = '';

        const toolbar = createElement('div', { className: 'puyow-tools-toolbar' }, rootElement);
        createElement('h1', { text: translate('Puyo W Dev Tools') }, toolbar);
        elements.puzzleModeButton = createElement('button', { text: translate('Edit Puzzle Puyo'), attributes: { type: 'button' } }, toolbar);
        elements.feverModeButton = createElement('button', { text: translate('Edit FEVER Pattern'), attributes: { type: 'button' } }, toolbar);
        elements.status = createElement('div', { className: 'puyow-tools-status', text: translate('Choose what to develop.') }, toolbar);
        // 상태 문구가 남은 자리를 모두 쓰므로, 그 뒤에 붙인 설정 버튼이 툴바 오른쪽 끝에 놓인다.
        elements.settingsButton = createElement('button', { text: translate('Settings'), attributes: { type: 'button' } }, toolbar);
        elements.feverModeButton.addEventListener('click', () => selectMode('fever'));
        elements.puzzleModeButton.addEventListener('click', () => selectMode('puzzle'));
        elements.settingsButton.addEventListener('click', openSettingsDialog);

        elements.body = createElement('div', { className: 'puyow-tools-body' }, rootElement);
        elements.empty = createElement('div', {
            className: 'puyow-tools-empty',
            text: translate('Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.')
        }, elements.body);

        elements.sidebar = createElement('div', { className: 'puyow-tools-sidebar' }, elements.body);
        elements.right = createElement('div', { className: 'puyow-tools-right' }, elements.body);
        elements.canvasHost = createElement('div', { className: 'puyow-tools-canvas' }, elements.right);
        elements.canvasRoot = createElement('div', { attributes: { id: 'puyow_tools_canvas_root' } }, elements.canvasHost);

        const output = createElement('div', { className: 'puyow-tools-output' }, elements.right);
        createElement('div', { className: 'puyow-tools-output-title', text: translate('Generated Script') }, output);
        elements.output = createElement('textarea', { attributes: { readonly: 'readonly', spellcheck: 'false' } }, output);

        elements.sidebar.hidden = true;
        elements.right.hidden = true;

        buildLoadDialog();
        buildPatternDialog();
        buildSettingsDialog();
        buildProgressOverlay();
        rootElement.addEventListener('keydown', stopKeyEventForFormField);
        window.addEventListener('resize', resizeCanvasRoot);
    }

    /**
     * localStorage에서 도구 페이지 설정을 읽는다. 저장 값이 없거나 깨져 있으면 기본값을 쓴다.
     * @returns {void}
     */
    function loadToolsSettings() {
        toolsSettingsRaw = {};
        toolsSettings = { ...DEFAULT_TOOLS_SETTINGS };
        try {
            const saved = window.localStorage.getItem(TOOLS_SETTINGS_STORE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
            toolsSettingsRaw = parsed;
            if (typeof parsed.darkMode === 'boolean') toolsSettings.darkMode = parsed.darkMode;
        } catch (error) {
            // 저장 값을 읽지 못해도 도구 사용 자체는 막지 않고 기본값으로 시작한다.
            toolsSettingsRaw = {};
        }
    }

    /**
     * 지금 설정을 localStorage에 JSON으로 저장한다.
     * @returns {boolean} 저장 성공 여부
     */
    function saveToolsSettings() {
        try {
            window.localStorage.setItem(TOOLS_SETTINGS_STORE_KEY, JSON.stringify({ ...toolsSettingsRaw, ...toolsSettings }));
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 지금 설정을 화면에 반영한다.
     * 게임 테스트 영역(canvas)은 puyow.js가 직접 그리므로 밝은 톤으로 바꾸지 않는다.
     * @returns {void}
     */
    function applyToolsSettings() {
        document.body.classList.toggle('puyow-tools-light', !toolsSettings.darkMode);
    }

    /**
     * 설정 값을 고를 레이어 팝업을 만든다.
     * @returns {void}
     */
    function buildSettingsDialog() {
        const dialog = createElement('div', { className: 'puyow-tools-dialog is-settings' }, rootElement);
        dialog.hidden = true;
        const panel = createElement('div', { className: 'puyow-tools-dialog-panel is-narrow' }, dialog);
        createElement('h2', { text: translate('Settings') }, panel);

        const section = createElement('div', { className: 'puyow-tools-section' }, panel);
        elements.darkModeInput = createElement('input', { attributes: { type: 'checkbox' } });
        appendField(section, translate('Use Dark Mode'), elements.darkModeInput);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Turning dark mode off lightens the tool screen. The game test area keeps its own colors.')
        }, section);

        const buttons = createElement('div', { className: 'puyow-tools-dialog-buttons' }, panel);
        const saveButton = createElement('button', { className: 'is-primary', text: translate('Save'), attributes: { type: 'button' } }, buttons);
        const cancelButton = createElement('button', { text: translate('Cancel'), attributes: { type: 'button' } }, buttons);
        saveButton.addEventListener('click', confirmSettingsDialog);
        cancelButton.addEventListener('click', closeSettingsDialog);
        elements.settingsDialog = dialog;
    }

    /** 설정 창을 연다. 지금 적용 중인 값을 각 칸에 채운다. @returns {void} */
    function openSettingsDialog() {
        elements.darkModeInput.checked = toolsSettings.darkMode;
        elements.settingsDialog.hidden = false;
        elements.darkModeInput.focus();
    }

    /** 설정 창을 닫는다. 고른 값은 저장하지 않는다. @returns {void} */
    function closeSettingsDialog() {
        elements.settingsDialog.hidden = true;
    }

    /** 설정 창에서 고른 값을 화면에 적용하고 localStorage에 저장한다. @returns {void} */
    function confirmSettingsDialog() {
        toolsSettings.darkMode = elements.darkModeInput.checked;
        applyToolsSettings();
        const saved = saveToolsSettings();
        closeSettingsDialog();
        setStatus(saved ? translate('Settings saved.') : translate('The settings were applied but could not be saved.'), saved ? 'done' : 'error');
    }

    /**
     * 스크립트를 붙여 넣을 레이어 팝업을 만든다.
     * @returns {void}
     */
    function buildLoadDialog() {
        const dialog = createElement('div', { className: 'puyow-tools-dialog is-load' }, rootElement);
        dialog.hidden = true;
        const panel = createElement('div', { className: 'puyow-tools-dialog-panel' }, dialog);
        createElement('h2', { text: translate('Load Script') }, panel);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Paste a script written as new FeverStageState(...) or new PuzzlePuyoStage({...}).')
        }, panel);
        elements.loadInput = createElement('textarea', { attributes: { spellcheck: 'false' } }, panel);
        const buttons = createElement('div', { className: 'puyow-tools-dialog-buttons' }, panel);
        const confirmButton = createElement('button', { className: 'is-primary', text: translate('OK'), attributes: { type: 'button' } }, buttons);
        const cancelButton = createElement('button', { text: translate('Cancel'), attributes: { type: 'button' } }, buttons);
        confirmButton.addEventListener('click', confirmLoadDialog);
        cancelButton.addEventListener('click', closeLoadDialog);
        elements.loadDialog = dialog;
    }

    /** 불러오기 팝업을 연다. @returns {void} */
    function openLoadDialog() {
        elements.loadInput.value = '';
        elements.loadDialog.hidden = false;
        elements.loadInput.focus();
    }

    /** 불러오기 팝업을 닫는다. @returns {void} */
    function closeLoadDialog() {
        elements.loadDialog.hidden = true;
    }

    /**
     * 팝업에 입력한 스크립트를 읽어 편집 화면에 반영한다.
     * @returns {void}
     */
    function confirmLoadDialog() {
        try {
            const stage = parseStageScript(elements.loadInput.value);
            applyLoadedStage(stage);
            closeLoadDialog();
            setStatus(translate('Existing data loaded.'), 'done');
        } catch (error) {
            setStatus(translate('Load failed: %1', error.message), 'error');
        }
    }

    /**
     * 붙여 넣은 스크립트를 실제 FeverStageState / PuzzlePuyoStage 객체로 만든다.
     * 게임과 같은 클래스를 그대로 써서 기본값과 생성자 처리까지 동일하게 맞춘다.
     * @param {string} text 입력한 스크립트
     * @returns {object} 만들어진 스테이지 객체
     */
    function parseStageScript(text) {
        const trimmed = String(text || '').trim().replace(/;+\s*$/, '');
        if (!trimmed) throw new Error(translate('Enter the script to load.'));
        const api = getGameApi();
        let stage = null;
        try {
            const factory = new Function('FeverStageState', 'PuzzlePuyoStage', `'use strict';\nreturn (\n${trimmed}\n);`);
            stage = factory(api.FeverStageState, api.PuzzlePuyoStage);
        } catch (error) {
            throw new Error(translate('The script could not be parsed. (%1)', error.message));
        }
        if (stage instanceof api.FeverStageState || stage instanceof api.PuzzlePuyoStage) return stage;
        throw new Error(translate('Not a FeverStageState or PuzzlePuyoStage object.'));
    }

    /**
     * 불러온 스테이지 객체를 알맞은 개발 화면에 반영한다.
     * @param {object} stage FeverStageState 또는 PuzzlePuyoStage 객체
     * @returns {void}
     */
    function applyLoadedStage(stage) {
        const api = getGameApi();
        const kind = stage instanceof api.FeverStageState ? 'fever' : 'puzzle';
        selectMode(kind);
        if (kind === 'fever') {
            elements.targetCombo.value = String(stage.targetCombo);
            elements.difficulty.value = String(stage.difficulty);
            setUsingColorRows(stage.usingColors);
        } else {
            elements.winConditionType.value = stage.winConditionType;
            elements.winConditionValue.value = String(stage.winConditionValue);
            elements.turnLimit.value = String(stage.turnLimit);
            elements.hint.value = stage.hint || '';
            refreshWinConditionValueState();
        }
        getToolsApi().setEditorData({
            stageData: stage.stageData,
            suppliedNextPuyos: stage.suppliedNextPuyos
        });
    }

    /**
     * puyow.js에 탑재된 기존 패턴을 고를 레이어 팝업을 만든다.
     * 목록은 열 때마다 지금 개발 중인 대상에 맞춰 다시 만든다.
     * @returns {void}
     */
    function buildPatternDialog() {
        const dialog = createElement('div', { className: 'puyow-tools-dialog is-pattern' }, rootElement);
        dialog.hidden = true;
        const panel = createElement('div', { className: 'puyow-tools-dialog-panel' }, dialog);
        createElement('h2', { text: translate('Load Existing Pattern') }, panel);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Choose a pattern to load into the editor.')
        }, panel);
        elements.patternList = createElement('div', { className: 'puyow-tools-pattern-list' }, panel);
        const buttons = createElement('div', { className: 'puyow-tools-dialog-buttons' }, panel);
        const cancelButton = createElement('button', { text: translate('Cancel'), attributes: { type: 'button' } }, buttons);
        cancelButton.addEventListener('click', closePatternDialog);
        elements.patternDialog = dialog;
    }

    /**
     * 지금 개발 중인 대상에 맞는 기존 패턴 목록을 게임 본체에서 가져온다.
     * 피버는 FEVER_STAGES를 그대로 내보내지 않으므로 직렬화 사본(getFeverStageDefinitions())으로
     * FeverStageState를 다시 만들고, 퍼즐뿌요는 등록된 PUZZLE_STAGES를 그대로 읽는다.
     * 편집 화면에 넣는 값은 setEditorData()가 복사하므로 게임의 원본 스테이지는 바뀌지 않는다.
     * @returns {object[]} 목록에 보여 줄 스테이지 객체
     */
    function collectExistingPatterns() {
        const api = getGameApi();
        if (currentMode === 'fever') {
            return (api.getFeverStageDefinitions() || []).map((definition) => new api.FeverStageState(
                definition.stageData,
                definition.targetCombo,
                definition.suppliedNextPuyos,
                definition.difficulty,
                definition.usingColors
            ));
        }
        return Array.isArray(api.PUZZLE_STAGES) ? api.PUZZLE_STAGES.slice() : [];
    }

    /**
     * 목록 한 줄에 보여 줄 설명 문구를 만든다. 사이드바에 쓰는 항목 이름을 그대로 써서 번역을 함께 맞춘다.
     * @param {object} stage FeverStageState 또는 PuzzlePuyoStage 객체
     * @returns {string} 설명 문구
     */
    function describeExistingPattern(stage) {
        if (currentMode === 'fever') {
            const colors = (stage.usingColors || []).map((color) => translate(color)).join(', ');
            return [
                `${translate('Target Chain')}: ${stage.targetCombo}`,
                `${translate('Difficulty')}: ${stage.difficulty}`,
                `${translate('Colors In Use')}: ${colors}`
            ].join(' / ');
        }
        const conditionType = WIN_CONDITION_TYPES.find((type) => type.value === stage.winConditionType);
        const parts = [`${translate('Win Condition')}: ${conditionType ? translate(conditionType.label) : stage.winConditionType}`];
        // 싹쓸이 목표는 목표 값을 쓰지 않으므로 사이드바와 같게 빼고 보여 준다.
        if (stage.winConditionType !== 'clear') parts.push(`${translate('Condition Value')}: ${stage.winConditionValue}`);
        parts.push(`${translate('Turn Limit')}: ${stage.turnLimit}`);
        if (stage.hint) parts.push(`${translate('Hint')}: ${stage.hint}`);
        return parts.join(' / ');
    }

    /**
     * 기존 패턴 팝업의 목록을 지금 개발 대상에 맞게 다시 만든다.
     * @returns {void}
     */
    function fillPatternList() {
        const list = elements.patternList;
        list.textContent = '';
        const stages = collectExistingPatterns();
        if (stages.length <= 0) {
            createElement('div', { className: 'puyow-tools-hint', text: translate('There is no pattern to load.') }, list);
            return;
        }
        stages.forEach((stage, index) => {
            const item = createElement('button', { className: 'puyow-tools-pattern-item', attributes: { type: 'button' } }, list);
            createElement('span', { className: 'puyow-tools-pattern-index', text: `#${index + 1}` }, item);
            createElement('span', { className: 'puyow-tools-pattern-detail', text: describeExistingPattern(stage) }, item);
            item.addEventListener('click', () => selectExistingPattern(stage));
        });
    }

    /**
     * 목록에서 고른 기존 패턴을 편집 화면에 반영하고 팝업을 닫는다.
     * @param {object} stage 고른 스테이지 객체
     * @returns {void}
     */
    function selectExistingPattern(stage) {
        try {
            applyLoadedStage(stage);
            setStatus(translate('Existing pattern loaded.'), 'done');
        } catch (error) {
            setStatus(translate('Load failed: %1', error.message), 'error');
        }
        closePatternDialog();
    }

    /** 기존 패턴 팝업을 연다. 목록은 열 때마다 새로 만든다. @returns {void} */
    function openPatternDialog() {
        fillPatternList();
        elements.patternDialog.hidden = false;
        const firstItem = elements.patternList.querySelector('button');
        if (firstItem) firstItem.focus();
    }

    /** 기존 패턴 팝업을 닫는다. 고르지 않으면 아무것도 바뀌지 않는다. @returns {void} */
    function closePatternDialog() {
        elements.patternDialog.hidden = true;
    }

    /**
     * 개발 대상을 고르고 그에 맞는 사이드바와 편집 화면을 준비한다.
     * @param {'fever'|'puzzle'} kind 개발 대상
     * @returns {void}
     */
    function selectMode(kind) {
        if (testing) {
            setStatus(translate('Choose again after the test finishes.'), 'error');
            return;
        }
        if (currentMode === kind) return;
        currentMode = kind;
        verifiedSnapshot = null;
        // 개발 대상이 바뀌면 직전 자동생성 결과와 비교할 이유가 없다.
        autoGenerateLastSignature = null;
        elements.feverModeButton.classList.toggle('is-active', kind === 'fever');
        elements.puzzleModeButton.classList.toggle('is-active', kind === 'puzzle');
        elements.empty.hidden = true;
        elements.sidebar.hidden = false;
        elements.right.hidden = false;
        elements.output.value = '';
        if (kind === 'fever') buildFeverSidebar();
        else buildPuzzleSidebar();
        if (!gameInitialized) {
            getGameApi().initialize(elements.canvasRoot);
            gameInitialized = true;
            observeCanvasSize();
        }
        getToolsApi().openEditor({ kind });
        resizeCanvasRoot();
        setStatus(kind === 'fever' ? translate('Editing a FEVER pattern.') : translate('Editing a Puzzle Puyo stage.'));
    }

    /**
     * 사이드바 위쪽의 공통 영역(불러오기 버튼들)을 만든다.
     * @returns {HTMLElement} 만들어진 영역
     */
    function buildCommonSection() {
        elements.sidebar.textContent = '';
        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: translate('Load') }, section);
        const buttons = createElement('div', { className: 'puyow-tools-buttons' }, section);
        const loadButton = createElement('button', { text: translate('Script'), attributes: { type: 'button' } }, buttons);
        loadButton.addEventListener('click', openLoadDialog);
        const patternButton = createElement('button', { text: translate('Existing Patterns'), attributes: { type: 'button' } }, buttons);
        patternButton.addEventListener('click', openPatternDialog);
        return section;
    }

    /**
     * 사이드바 아래쪽의 공통 조작 버튼을 만든다.
     * @returns {void}
     */
    function buildControlSection() {
        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: translate('Controls') }, section);
        const buttons = createElement('div', { className: 'puyow-tools-buttons' }, section);
        elements.autoGenerateButton = createElement('button', { text: translate('Auto Generate'), attributes: { type: 'button' } }, buttons);
        elements.testButton = createElement('button', { text: translate('Test'), attributes: { type: 'button' } }, buttons);
        elements.generateButton = createElement('button', { className: 'is-primary', text: translate('Generate Script'), attributes: { type: 'button' } }, buttons);
        elements.autoGenerateButton.addEventListener('click', startAutoGenerate);
        elements.testButton.addEventListener('click', () => runTest());
        elements.generateButton.addEventListener('click', generateScript);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Pick a puyo from the palette at the right of the canvas, then click or drag on the left play field and on the "Next Puyos" cells in the middle.')
        }, section);
    }

    /**
     * 피버 패턴 개발용 사이드바를 만든다.
     * @returns {void}
     */
    function buildFeverSidebar() {
        buildCommonSection();

        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: translate('FEVER Pattern') }, section);

        elements.targetCombo = createElement('input', {
            attributes: { type: 'number', min: String(FEVER_TARGET_COMBO_MIN), max: String(FEVER_TARGET_COMBO_MAX), step: '1', value: '5' }
        });
        appendField(section, translate('Target Chain'), elements.targetCombo);

        elements.difficulty = createElement('input', { attributes: { type: 'number', min: '1', step: '1', value: '1' } });
        appendField(section, translate('Difficulty'), elements.difficulty);

        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Target chain is an integer from %1 to %2, and difficulty an integer of 1 or more.', FEVER_TARGET_COMBO_MIN, FEVER_TARGET_COMBO_MAX)
        }, section);

        const colorSection = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: translate('Colors In Use') }, colorSection);
        const table = createElement('table', { className: 'puyow-tools-grid' }, colorSection);
        const headRow = createElement('tr', {}, createElement('thead', {}, table));
        createElement('th', { text: translate('No.') }, headRow);
        createElement('th', { text: translate('Color') }, headRow);
        createElement('th', { text: '' }, headRow);
        elements.usingColorBody = createElement('tbody', {}, table);
        const colorButtons = createElement('div', { className: 'puyow-tools-buttons' }, colorSection);
        colorButtons.style.marginTop = '8px';
        const addColorButton = createElement('button', { className: 'is-small', text: translate('Add Color'), attributes: { type: 'button' } }, colorButtons);
        addColorButton.addEventListener('click', () => {
            const used = readUsingColorValues();
            const unused = COLORS.find((color) => !used.includes(color)) || COLORS[0];
            addUsingColorRow(unused);
        });
        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Only red, blue, green, yellow and purple can be chosen. Use %1 to %2 colors, and do not add the same color twice.', FEVER_USING_COLOR_MIN, FEVER_USING_COLOR_MAX)
        }, colorSection);
        setUsingColorRows(DEFAULT_FEVER_USING_COLORS);

        buildControlSection();
    }

    /**
     * 퍼즐뿌요 개발용 사이드바를 만든다.
     * @returns {void}
     */
    function buildPuzzleSidebar() {
        buildCommonSection();

        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: translate('Puzzle Puyo') }, section);

        elements.winConditionType = createElement('select', {});
        WIN_CONDITION_TYPES.forEach((type) => {
            const option = createElement('option', { text: translate(type.label) }, elements.winConditionType);
            option.value = type.value;
        });
        appendField(section, translate('Win Condition'), elements.winConditionType);

        elements.winConditionValue = createElement('input', { attributes: { type: 'number', min: '1', step: '1', value: '4' } });
        appendField(section, translate('Condition Value'), elements.winConditionValue);

        elements.turnLimit = createElement('input', { attributes: { type: 'number', min: String(PUZZLE_TURN_LIMIT_MIN), max: String(PUZZLE_TURN_LIMIT_MAX), step: '1', value: '2' } });
        appendField(section, translate('Turn Limit'), elements.turnLimit);

        elements.hint = createElement('input', { attributes: { type: 'text', maxlength: '80', value: '' } });
        appendField(section, translate('Hint'), elements.hint);

        elements.winConditionDescription = createElement('div', { className: 'puyow-tools-hint', text: '' }, section);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: translate('Turn limit is an integer from %1 to %2, and the next puyos must be filled for at least that many turns. The hint may be left empty.', PUZZLE_TURN_LIMIT_MIN, PUZZLE_TURN_LIMIT_MAX)
        }, section);

        elements.winConditionType.addEventListener('change', refreshWinConditionValueState);
        refreshWinConditionValueState();

        buildControlSection();
    }

    /**
     * 목표 타입에 맞춰 목표 타입 값 입력 칸의 사용 여부와 설명을 갱신한다.
     * clear(싹쓸이)는 목표 값이 의미 없으므로 입력 칸을 잠근다.
     * @returns {void}
     */
    function refreshWinConditionValueState() {
        const selected = WIN_CONDITION_TYPES.find((type) => type.value === elements.winConditionType.value);
        const isClear = elements.winConditionType.value === 'clear';
        elements.winConditionValue.disabled = isClear;
        elements.winConditionDescription.textContent = selected ? translate(selected.description) : '';
    }

    /**
     * 사용할 색상 목록 그리드에 한 줄을 추가한다.
     * @param {string} color 처음 선택해 둘 색
     * @returns {void}
     */
    function addUsingColorRow(color) {
        if (elements.usingColorBody.children.length >= COLORS.length) {
            setStatus(translate('You can add up to %1 colors.', COLORS.length), 'error');
            return;
        }
        const row = createElement('tr', {}, elements.usingColorBody);
        const indexCell = createElement('td', { className: 'is-narrow' }, row);
        const colorCell = createElement('td', {}, row);
        const buttonCell = createElement('td', { className: 'is-narrow' }, row);

        const sample = createElement('span', { className: 'puyow-tools-color-sample' }, colorCell);
        const select = createElement('select', {}, colorCell);
        select.style.marginLeft = '6px';
        COLORS.forEach((value) => {
            // 영어에서는 번역이 색 이름과 같으므로 괄호 없이 색 이름만 보여 준다.
            const label = translate(value);
            const option = createElement('option', { text: label === value ? value : `${value} (${label})` }, select);
            option.value = value;
        });
        select.value = COLORS.includes(color) ? color : COLORS[0];
        sample.style.background = COLOR_SAMPLES[select.value];
        select.addEventListener('change', () => { sample.style.background = COLOR_SAMPLES[select.value]; });

        const removeButton = createElement('button', { className: 'is-small is-danger', text: translate('Delete'), attributes: { type: 'button' } }, buttonCell);
        removeButton.addEventListener('click', () => {
            row.remove();
            refreshUsingColorIndexes();
        });
        indexCell.textContent = String(elements.usingColorBody.children.length);
        refreshUsingColorIndexes();
    }

    /** 사용할 색상 목록 그리드의 순번 칸을 다시 매긴다. @returns {void} */
    function refreshUsingColorIndexes() {
        Array.from(elements.usingColorBody.children).forEach((row, index) => {
            row.children[0].textContent = String(index + 1);
        });
    }

    /**
     * 사용할 색상 목록 그리드를 지정한 색 목록으로 다시 채운다.
     * @param {string[]} colors 채울 색 목록
     * @returns {void}
     */
    function setUsingColorRows(colors) {
        elements.usingColorBody.textContent = '';
        const values = (Array.isArray(colors) ? colors : []).filter((color) => COLORS.includes(color));
        (values.length ? values : DEFAULT_FEVER_USING_COLORS).forEach((color) => addUsingColorRow(color));
    }

    /** @returns {string[]} 사용할 색상 목록 그리드에 지금 들어 있는 색 목록 */
    function readUsingColorValues() {
        return Array.from(elements.usingColorBody.querySelectorAll('select')).map((select) => select.value);
    }

    /**
     * 숫자 입력 칸에서 정수를 읽는다.
     * @param {HTMLInputElement} input 입력 칸
     * @param {string} name 오류 문구에 쓸 항목 이름
     * @returns {number} 읽은 정수
     */
    function readIntegerField(input, name) {
        const text = String(input.value || '').trim();
        if (!text) throw new Error(translate('Enter %1.', name));
        const value = Number(text);
        if (!Number.isInteger(value)) throw new Error(translate('%1 must be an integer.', name));
        return value;
    }

    /**
     * 캔버스에서 편집 중인 배치와 지급 뿌요를 읽는다.
     * @returns {{stageData:object, nextPuyos:(string|null)[][]}} 편집 중인 데이터
     */
    function readEditorData(requirePuyos = true) {
        const editor = getToolsApi().getEditorData();
        if (!editor) throw new Error(translate('The editor is not ready.'));
        if (requirePuyos && !editor.stageData.puyos.length) throw new Error(translate('Place at least one puyo on the play field.'));
        return editor;
    }

    /**
     * 편집 중인 값으로 FeverStageState 객체를 만든다. 잘못된 값이 있으면 예외를 던진다.
     * @param {{requirePuyos?:boolean}} [options] requirePuyos가 false면 빈 플레이 영역도 허용한다.
     * @returns {object} 만들어진 FeverStageState
     */
    function collectFeverStage(options = {}) {
        const editor = readEditorData(options.requirePuyos !== false);
        const targetCombo = readIntegerField(elements.targetCombo, translate('Target Chain'));
        if (targetCombo < FEVER_TARGET_COMBO_MIN || targetCombo > FEVER_TARGET_COMBO_MAX) {
            throw new Error(translate('Target chain must be from %1 to %2.', FEVER_TARGET_COMBO_MIN, FEVER_TARGET_COMBO_MAX));
        }
        const difficulty = readIntegerField(elements.difficulty, translate('Difficulty'));
        if (difficulty < 1) throw new Error(translate('Difficulty must be an integer of 1 or more.'));

        const usingColors = readUsingColorValues();
        if (usingColors.length < FEVER_USING_COLOR_MIN || usingColors.length > FEVER_USING_COLOR_MAX) {
            throw new Error(translate('The colors in use must have %1 to %2 colors.', FEVER_USING_COLOR_MIN, FEVER_USING_COLOR_MAX));
        }
        const duplicated = usingColors.find((color, index) => usingColors.indexOf(color) !== index);
        if (duplicated) throw new Error(translate('The colors in use contain "%1" more than once.', duplicated));

        const supplied = editor.nextPuyos[0] || [];
        if (!supplied[0] || !supplied[1]) throw new Error(translate('Fill both cells of the next puyos.'));

        const colorSet = new Set(usingColors);
        const invalidPuyo = editor.stageData.puyos.find((puyo) => puyo.color !== 'garbage' && !colorSet.has(puyo.color));
        if (invalidPuyo) throw new Error(translate('The color "%1" on the play field is not in the colors in use.', invalidPuyo.color));
        const invalidSupplied = supplied.find((color) => !colorSet.has(color));
        if (invalidSupplied) throw new Error(translate('The color "%1" of the next puyos is not in the colors in use.', invalidSupplied));

        return new (getGameApi().FeverStageState)(editor.stageData, targetCombo, [supplied[0], supplied[1]], difficulty, usingColors);
    }

    /**
     * 편집 중인 "다음에 나올 뿌요" 칸을 퍼즐뿌요의 지급 목록으로 바꾼다.
     * 목표 턴수만큼은 반드시 채워져 있어야 하며, 그보다 더 많은 턴이 채워진 것은 허용한다.
     * @param {(string|null)[][]} nextPuyos 턴별 지급 뿌요
     * @param {number} turnLimit 목표 턴수
     * @returns {string[][]} 앞에서부터 이어지는 완성된 턴 목록
     */
    function collectPuzzleNextPuyos(nextPuyos, turnLimit) {
        const pairs = [];
        let emptyTurnFound = false;
        nextPuyos.forEach((pair, index) => {
            const filled = [pair[0], pair[1]].filter((color) => Boolean(color));
            if (filled.length === 0) { emptyTurnFound = true; return; }
            if (filled.length === 1) throw new Error(translate('One cell of turn %1 of the next puyos is empty.', index + 1));
            if (emptyTurnFound) throw new Error(translate('There is an empty turn before turn %1 of the next puyos.', index + 1));
            pairs.push([pair[0], pair[1]]);
        });
        if (pairs.length < turnLimit) throw new Error(translate('Fill the next puyos for all %1 turns of the turn limit.', turnLimit));
        return pairs;
    }

    /**
     * 편집 중인 값으로 PuzzlePuyoStage 객체를 만든다. 잘못된 값이 있으면 예외를 던진다.
     * @param {{requirePuyos?:boolean}} [options] requirePuyos가 false면 빈 플레이 영역도 허용한다.
     * @returns {object} 만들어진 PuzzlePuyoStage
     */
    function collectPuzzleStage(options = {}) {
        const editor = readEditorData(options.requirePuyos !== false);
        const winConditionType = elements.winConditionType.value;
        if (!WIN_CONDITION_TYPES.some((type) => type.value === winConditionType)) throw new Error(translate('Choose a win condition.'));
        let winConditionValue = 0;
        if (winConditionType !== 'clear') {
            winConditionValue = readIntegerField(elements.winConditionValue, translate('Condition Value'));
            if (winConditionValue < 1) throw new Error(translate('The condition value must be an integer of 1 or more.'));
        }
        const turnLimit = readIntegerField(elements.turnLimit, translate('Turn Limit'));
        if (turnLimit < PUZZLE_TURN_LIMIT_MIN || turnLimit > PUZZLE_TURN_LIMIT_MAX) {
            throw new Error(translate('The turn limit must be from %1 to %2.', PUZZLE_TURN_LIMIT_MIN, PUZZLE_TURN_LIMIT_MAX));
        }
        const suppliedNextPuyos = collectPuzzleNextPuyos(editor.nextPuyos, turnLimit);

        return new (getGameApi().PuzzlePuyoStage)({
            stageData: editor.stageData,
            suppliedNextPuyos,
            turnLimit,
            winConditionType,
            winConditionValue,
            hint: String(elements.hint.value || '').trim()
        });
    }

    /**
     * 작은따옴표 문자열에 넣을 수 있게 문자를 escape 한다.
     * @param {string} text 원본 문자열
     * @returns {string} escape 한 문자열
     */
    function escapeSingleQuoted(text) {
        return String(text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
    }

    /**
     * 색 이름 배열을 작은따옴표 목록 문자열로 바꾼다.
     * @param {string[]} colors 색 목록
     * @returns {string} 예: ['red', 'green']
     */
    function formatColorArray(colors) {
        return `[${colors.map((color) => `'${color}'`).join(', ')}]`;
    }

    /**
     * FeverStageState 생성 스크립트를 만든다.
     * @param {object} stage 대상 스테이지
     * @returns {string} 자바스크립트 코드
     */
    function formatFeverScript(stage) {
        return [
            'new FeverStageState(',
            `    ${JSON.stringify(stage.stageData)},`,
            `    ${stage.targetCombo},`,
            `    ${formatColorArray(stage.suppliedNextPuyos)},`,
            `    ${stage.difficulty},`,
            `    ${formatColorArray(stage.usingColors)}`,
            ')'
        ].join('\n');
    }

    /**
     * PuzzlePuyoStage 생성 스크립트를 만든다.
     * @param {object} stage 대상 스테이지
     * @returns {string} 자바스크립트 코드
     */
    function formatPuzzleScript(stage) {
        const suppliedText = `[${stage.suppliedNextPuyos.map((pair) => formatColorArray(pair)).join(', ')}]`;
        return [
            'new PuzzlePuyoStage({',
            `    stageData : ${JSON.stringify(stage.stageData)},`,
            `    suppliedNextPuyos : ${suppliedText},`,
            `    turnLimit : ${stage.turnLimit},`,
            `    winConditionType : '${stage.winConditionType}',`,
            `    winConditionValue : ${stage.winConditionValue},`,
            `    hint : '${escapeSingleQuoted(stage.hint)}'`,
            '})'
        ].join('\n');
    }

    /**
     * 스크립트 생성 전 재테스트가 필요한지 판단하기 위한 편집 내용 지문을 만든다.
     * 배치와 지급 뿌요, 그리고 목표 달성 여부에 영향을 주는 입력값만 담는다.
     * 난이도와 힌트는 달성 가능성과 무관하므로 넣지 않는다.
     * @returns {string} 현재 편집 내용을 나타내는 문자열
     */
    function buildVerificationSnapshot() {
        const editor = getToolsApi().getEditorData();
        const fields = currentMode === 'fever'
            ? { targetCombo: elements.targetCombo.value }
            : {
                winConditionType: elements.winConditionType.value,
                winConditionValue: elements.winConditionValue.value,
                turnLimit: elements.turnLimit.value
            };
        return JSON.stringify({
            kind: currentMode,
            stageData: editor?.stageData ?? null,
            nextPuyos: editor?.nextPuyos ?? null,
            fields
        });
    }

    /**
     * 테스트 결과가 목표를 정확히 달성했는지 판정한다.
     * 피버 패턴과 퍼즐뿌요의 combo 목표는 목표치를 넘겨도 실패로 본다. 목표 연쇄 수로
     * 패턴을 분류해 쓰기 때문에, 더 많이 터지는 배치는 그 목표의 패턴이 아니기 때문이다.
     * @param {object} stage 테스트한 스테이지 객체
     * @param {object|null} result 게임이 돌려준 테스트 결과
     * @returns {{success:boolean, message:string}} 판정 결과와 표시할 문구
     */
    function judgeTestResult(stage, result) {
        const successMessage = translate('Test succeeded. You can now generate the script.');
        if (currentMode === 'fever') {
            const combo = result?.kind === 'fever' ? result.combo : 0;
            if (combo !== stage.targetCombo) {
                return { success: false, message: translate('Test failed: the first supplied pair made %1 chains, but exactly %2 chains are required.', combo, stage.targetCombo) };
            }
            return { success: true, message: successMessage };
        }
        if (result?.kind !== 'puzzle' || !result.cleared) {
            return { success: false, message: translate('Test failed: the goal was not reached.') };
        }
        if (result.turn > stage.turnLimit) {
            return { success: false, message: translate('Test failed: the goal was reached on turn %1, but the turn limit is %2.', result.turn, stage.turnLimit) };
        }
        if (stage.winConditionType === 'combo' && result.combo !== stage.winConditionValue) {
            return { success: false, message: translate('Test failed: the chain was %1, but exactly %2 chains are required.', result.combo, stage.winConditionValue) };
        }
        return { success: true, message: successMessage };
    }

    /**
     * 편집 중인 내용을 검사한 뒤 자바스크립트 코드를 출력 영역에 적는다.
     * 테스트에 성공한 내용 그대로일 때만 생성한다.
     * @returns {void}
     */
    function generateScript() {
        try {
            if (verifiedSnapshot === null) throw new Error(translate('Run a successful test before generating the script.'));
            if (verifiedSnapshot !== buildVerificationSnapshot()) {
                throw new Error(translate('The data changed after the test. Run the test again before generating the script.'));
            }
            if (currentMode === 'fever') {
                elements.output.value = formatFeverScript(collectFeverStage());
            } else {
                elements.output.value = formatPuzzleScript(collectPuzzleStage());
            }
            setStatus(translate('Script generated.'), 'done');
        } catch (error) {
            elements.output.value = '';
            setStatus(translate('Script generation failed: %1', error.message), 'error');
        }
    }

    /**
     * 테스트 진행 여부에 맞춰 화면 조작 가능 상태를 바꾼다.
     * @param {boolean} running 테스트 진행 중 여부
     * @returns {void}
     */
    function setTesting(running) {
        testing = running;
        [elements.testButton, elements.generateButton, elements.autoGenerateButton, elements.feverModeButton, elements.puzzleModeButton].forEach((button) => {
            if (button) button.disabled = running;
        });
        elements.sidebar.querySelectorAll('input, select').forEach((field) => { field.disabled = running; });
        if (!running && currentMode === 'puzzle' && elements.winConditionType) refreshWinConditionValueState();
    }

    /**
     * 편집 중인 내용으로 실제 게임 진행 코드를 사용해 테스트를 시작한다.
     * @returns {{started:boolean, message:string}} 시작 여부와 화면에 적은 문구
     */
    function runTest() {
        let stage = null;
        try {
            stage = currentMode === 'fever' ? collectFeverStage() : collectPuzzleStage();
        } catch (error) {
            const message = translate('Test failed: %1', error.message);
            setStatus(message, 'error');
            return { started: false, message };
        }
        try {
            setTesting(true);
            // 키보드 조작이 입력 칸으로 새지 않도록 포커스를 캔버스 쪽으로 옮긴다.
            if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
            const onFinish = (result) => {
                setTesting(false);
                const verdict = judgeTestResult(stage, result);
                // 성공한 내용 그대로일 때만 스크립트를 만들 수 있도록 지문을 남긴다.
                verifiedSnapshot = verdict.success ? buildVerificationSnapshot() : null;
                setStatus(verdict.message, verdict.success ? 'done' : 'error');
            };
            if (currentMode === 'fever') getToolsApi().startFeverTest(stage, onFinish);
            else getToolsApi().startPuzzleTest(stage, onFinish);
            const message = currentMode === 'fever'
                ? translate('FEVER test in progress. Play with the keyboard. (ESC: pause)')
                : translate('Puzzle Puyo test in progress. Play with the keyboard. (ESC: pause)');
            setStatus(message);
            return { started: true, message };
        } catch (error) {
            setTesting(false);
            const message = translate('Test failed: %1', error.message);
            setStatus(message, 'error');
            return { started: false, message };
        }
    }


    /**
     * 자동생성 Worker의 본체다.
     * Blob URL로 만들 스크립트에 문자열로 넣기 때문에 바깥 변수를 참조하지 않고,
     * 필요한 값은 모두 constants와 메시지로 받는다. 게임 코드를 그대로 가져올 수 없어
     * 연쇄 판정을 여기서 다시 구현하지만, 이것은 후보를 고르기 위한 근사 판정일 뿐이다.
     * 최종 확인은 본래 쓰레드가 puyow.js의 코드로 다시 하므로, 두 판정이 어긋나도
     * 잘못된 배치가 그대로 반영되지는 않는다.
     * @param {{columns:number, rows:number, branch:number, startNodes:number}} constants 탐색 설정
     * @returns {void}
     */
    function autoGenerateWorkerBootstrap(constants) {
        const { columns, rows, branch, startNodes } = constants;
        const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        const cloneBoard = (board) => board.map((row) => [...row]);
        const emptyBoard = () => Array.from({ length: rows }, () => Array(columns).fill(null));

        const collapse = (board) => {
            for (let x = 0; x < columns; x += 1) {
                const stack = [];
                for (let y = 0; y < rows; y += 1) if (board[y][x]) stack.push(board[y][x]);
                for (let y = 0; y < rows; y += 1) board[y][x] = stack[y] || null;
            }
        };

        // 한 단계에서 사라질 칸을 모은다. 색 뿌요 4개 이상 연결과 그에 닿은 방해뿌요가 대상이다.
        // 목표 판정에 쓰려고 이 단계에서 터진 색 뿌요 수와 색 종류 수도 함께 센다.
        const findRemovedStep = (board) => {
            const seen = Array.from({ length: rows }, () => Array(columns).fill(false));
            const removed = new Set();
            const colorsPopped = new Set();
            let popped = 0;
            for (let y = 0; y < rows; y += 1) {
                for (let x = 0; x < columns; x += 1) {
                    const color = board[y][x];
                    if (!color || color === 'garbage' || seen[y][x]) continue;
                    const group = [];
                    const queue = [[x, y]];
                    seen[y][x] = true;
                    while (queue.length) {
                        const [cx, cy] = queue.pop();
                        group.push([cx, cy]);
                        neighbors.forEach(([dx, dy]) => {
                            const nx = cx + dx;
                            const ny = cy + dy;
                            if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || seen[ny][nx]) return;
                            if (board[ny][nx] !== color) return;
                            seen[ny][nx] = true;
                            queue.push([nx, ny]);
                        });
                    }
                    if (group.length < 4) continue;
                    colorsPopped.add(color);
                    popped += group.length;
                    group.forEach(([gx, gy]) => {
                        removed.add(gy * columns + gx);
                        neighbors.forEach(([dx, dy]) => {
                            const nx = gx + dx;
                            const ny = gy + dy;
                            if (nx < 0 || nx >= columns || ny < 0 || ny >= rows) return;
                            if (board[ny][nx] === 'garbage') removed.add(ny * columns + nx);
                        });
                    });
                }
            }
            return { removed, popped, colors: colorsPopped.size };
        };

        const heightOf = (board, x) => {
            let height = 0;
            while (height < rows && board[height][x]) height += 1;
            return height;
        };

        // 회전 상태에 따라 쌍을 떨어뜨린 보드를 만든다. 놓을 자리가 없으면 null이다.
        const placePair = (board, x, rotation, pair) => {
            const [dx, dy] = offsets[rotation];
            const childX = x + dx;
            if (x < 0 || x >= columns || childX < 0 || childX >= columns) return null;
            const work = cloneBoard(board);
            if (dy === 0) {
                const axisY = heightOf(work, x);
                const childY = heightOf(work, childX);
                if (axisY >= rows || childY >= rows) return null;
                work[axisY][x] = pair[0];
                work[childY][childX] = pair[1];
                return work;
            }
            const base = heightOf(work, x);
            if (base + 1 >= rows) return null;
            if (dy > 0) { work[base][x] = pair[0]; work[base + 1][x] = pair[1]; }
            else { work[base][x] = pair[1]; work[base + 1][x] = pair[0]; }
            return work;
        };

        // 한 판을 끝까지 연쇄시키며, 목표 판정에 필요한 값을 함께 모은다.
        const resolveDetail = (board) => {
            const work = cloneBoard(board);
            collapse(work);
            const detail = { combo: 0, popped: 0, colors: 0, allClear: false };
            for (;;) {
                const step = findRemovedStep(work);
                if (!step.removed.size) break;
                step.removed.forEach((index) => { work[Math.floor(index / columns)][index % columns] = null; });
                collapse(work);
                detail.combo += 1;
                if (step.popped > detail.popped) detail.popped = step.popped;
                if (step.colors > detail.colors) detail.colors = step.colors;
            }
            detail.allClear = detail.combo > 0 && work.every((row) => row.every((cell) => !cell));
            return detail;
        };

        // 쌍을 놓을 수 있는 모든 자리 가운데 가장 좋은 값을 모은다.
        const evaluate = (board, pair) => {
            const best = { combo: 0, popped: 0, colors: 0, allClear: false };
            for (let rotation = 0; rotation < 4; rotation += 1) {
                for (let x = 0; x < columns; x += 1) {
                    const placed = placePair(board, x, rotation, pair);
                    if (!placed) continue;
                    const detail = resolveDetail(placed);
                    if (detail.combo > best.combo) best.combo = detail.combo;
                    if (detail.popped > best.popped) best.popped = detail.popped;
                    if (detail.colors > best.colors) best.colors = detail.colors;
                    if (detail.allClear) best.allClear = true;
                }
            }
            return best;
        };

        // 목표 종류에 따라 무엇을 키워 갈지 정한다.
        const metricOf = (detail, objective) => {
            if (objective.kind === 'multiple') return detail.popped;
            if (objective.kind === 'color') return detail.colors;
            return detail.combo;
        };

        // 목표를 이미 이뤘는지 본다. attack은 실제 계산식이 게임 쪽에만 있으므로
        // 연쇄가 생기면 후보로 올리고, 정말 충분한지는 본래 쓰레드가 판단한다.
        const satisfied = (detail, objective) => {
            if (objective.kind === 'combo') return detail.combo === objective.target;
            if (objective.kind === 'clear') return detail.allClear;
            if (objective.kind === 'multiple') return detail.popped >= objective.target;
            if (objective.kind === 'color') return detail.colors >= objective.target;
            return detail.combo >= objective.target;
        };

        // 열 p에 m개, 열 q에 n개의 같은 색 뿌요를 쌓는다. 자리가 모자라면 null이다.
        const addGroup = (board, color, p, q, m, n) => {
            const work = cloneBoard(board);
            let hp = heightOf(work, p);
            if (hp + m > rows) return null;
            for (let index = 0; index < m; index += 1) { work[hp][p] = color; hp += 1; }
            if (n > 0) {
                let hq = heightOf(work, q);
                if (hq + n > rows) return null;
                for (let index = 0; index < n; index += 1) { work[hq][q] = color; hq += 1; }
            }
            return work;
        };

        const buildCandidates = (board, colors) => {
            const list = [];
            colors.forEach((color) => {
                for (let p = 0; p < columns; p += 1) {
                    [p + 1, p - 1].forEach((q) => {
                        for (let m = 0; m <= 4; m += 1) {
                            for (let n = 0; n <= 4; n += 1) {
                                if (m + n < 1 || m + n > 4) continue;
                                if (n > 0 && (q < 0 || q >= columns)) continue;
                                // n이 0이면 q는 쓰이지 않으므로 같은 배치를 두 번 만들지 않는다.
                                if (n === 0 && q !== p + 1) continue;
                                const next = addGroup(board, color, p, q, m, n);
                                if (next) list.push({ board: next, added: m + n });
                            }
                        }
                    });
                }
            });
            return list;
        };

        const makeRandom = (seed) => {
            let state = seed >>> 0;
            return () => {
                state = (state * 1664525 + 1013904223) >>> 0;
                return state / 4294967296;
            };
        };

        const shuffle = (list, random) => {
            for (let index = list.length - 1; index > 0; index -= 1) {
                const other = Math.floor(random() * (index + 1));
                const swap = list[index];
                list[index] = list[other];
                list[other] = swap;
            }
            return list;
        };

        // 목표에 한 걸음 더 다가가는 후보만, 더하는 뿌요가 적은 순으로 추린다.
        // 연쇄 수를 키우는 목표는 한 번에 하나씩만 올려야 목표치를 넘기지 않는다.
        const nextSteps = (board, colors, pair, detail, objective, random) => {
            const current = metricOf(detail, objective);
            const exact = objective.kind === 'combo' || objective.kind === 'clear' || objective.kind === 'attack';
            const found = [];
            buildCandidates(board, colors).forEach((candidate) => {
                // 쌍을 놓기도 전에 스스로 터지는 배치는 쓸 수 없다.
                if (resolveDetail(candidate.board).combo !== 0) return;
                const next = evaluate(candidate.board, pair);
                const value = metricOf(next, objective);
                if (exact) {
                    if (value !== current + 1) return;
                } else if (value <= current) {
                    // 목표 값이 그대로여도 연쇄가 한 단계 늘면, 다음 단계에서 여러 그룹이
                    // 한꺼번에 터질 길이 열린다. 값이 계단식으로만 오르는 color 목표에 필요하다.
                    if (value < current || next.combo !== detail.combo + 1) return;
                }
                found.push({ board: candidate.board, added: candidate.added, detail: next, gain: value - current });
            });
            shuffle(found, random);
            // 목표 값을 실제로 올리는 후보를 먼저 보고, 같은 조건이면 더하는 뿌요가 적은 쪽을 고른다.
            found.sort((left, right) => (right.gain - left.gain) || (left.added - right.added));
            return found.slice(0, branch);
        };

        // 목표를 이룰 때까지 한 걸음씩 키워 간다. 막히면 직전 선택을 바꿔 다시 시도한다.
        const search = (startBoard, colors, pair, objective, random, nodeBudget, deadline) => {
            const budget = { nodes: nodeBudget };
            const walk = (board, detail) => {
                if (satisfied(detail, objective)) return board;
                // 한 판이 길어져도 정해 둔 시각을 넘기지 않도록 여기서도 확인한다.
                if (budget.nodes <= 0 || Date.now() > deadline) return null;
                budget.nodes -= 1;
                const steps = nextSteps(board, colors, pair, detail, objective, random);
                for (let index = 0; index < steps.length; index += 1) {
                    const result = walk(steps[index].board, steps[index].detail);
                    if (result) return result;
                    if (budget.nodes <= 0) return null;
                }
                return null;
            };
            return walk(startBoard, evaluate(startBoard, pair));
        };

        const toPuyos = (board) => {
            const puyos = [];
            for (let y = 0; y < rows; y += 1) {
                for (let x = 0; x < columns; x += 1) if (board[y][x]) puyos.push({ x, y, color: board[y][x] });
            }
            return puyos;
        };

        let job = null;

        const runJob = () => {
            while (Date.now() < job.deadline) {
                job.seed += 1;
                const result = search(job.board, job.colors, job.pair, job.objective, makeRandom(job.seed * 7919), job.nodes, job.deadline);
                job.nodes = Math.min(job.nodes * 2, 4000);
                if (result) {
                    self.postMessage({ type: 'found', puyos: toPuyos(result) });
                    return;
                }
                // attack 목표는 실제 계산식을 여기서 알 수 없으므로, 막히면 연쇄를 한 단계 더 노린다.
                if (job.objective.kind === 'attack' && job.objective.target < 12) {
                    job.objective = { kind: 'attack', target: job.objective.target + 1 };
                    job.nodes = startNodes;
                }
            }
            self.postMessage({ type: 'failed' });
        };

        self.onmessage = (event) => {
            const data = event.data || {};
            if (data.type === 'start') {
                const board = emptyBoard();
                (data.puyos || []).forEach((puyo) => {
                    if (puyo.y >= 0 && puyo.y < rows && puyo.x >= 0 && puyo.x < columns) board[puyo.y][puyo.x] = puyo.color;
                });
                collapse(board);
                if (resolveDetail(board).combo !== 0) { self.postMessage({ type: 'unstable' }); return; }
                const objective = data.objective;
                if (objective.kind === 'combo' && evaluate(board, data.pair).combo > objective.target) {
                    self.postMessage({ type: 'overshoot' });
                    return;
                }
                job = {
                    board,
                    colors: data.colors,
                    pair: data.pair,
                    objective,
                    deadline: Date.now() + data.timeLimit,
                    // 씨앗을 본래 쓰레드에서 받아 매번 다르게 시작한다. 조건을 만족하는 배치가
                    // 여럿일 때 자동생성을 누를 때마다 다른 결과가 나오게 하려는 것이다.
                    seed: Number(data.seed) || 0,
                    nodes: startNodes
                };
                runJob();
                return;
            }
            // 본래 쓰레드가 게임 코드로 확인했을 때 목표와 달랐다면 다음 후보를 찾는다.
            if (data.type === 'reject' && job) {
                if (job.objective.kind === 'attack' && job.objective.target < 12) {
                    job.objective = { kind: 'attack', target: job.objective.target + 1 };
                    job.nodes = startNodes;
                }
                runJob();
            }
        };
    }

    /**
     * 자동생성 Worker를 만든다. Worker를 쓸 수 없는 환경이면 예외를 던진다.
     * 별도 파일을 두지 않고 위 본체 함수를 문자열로 만들어 Blob URL로 띄운다.
     * @returns {Worker} 만들어진 Worker
     */
    function createAutoGenerateWorker() {
        if (typeof Worker !== 'function' || typeof Blob !== 'function' || !URL?.createObjectURL) {
            throw new Error(translate('This browser cannot run the background search.'));
        }
        const constants = { ...AUTO_GENERATE_BOARD, branch: AUTO_GENERATE_BRANCH, startNodes: AUTO_GENERATE_START_NODES };
        const source = `(${autoGenerateWorkerBootstrap.toString()})(${JSON.stringify(constants)});`;
        const objectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        try {
            const worker = new Worker(objectUrl);
            // WebKit은 Worker 스크립트를 비동기로 읽는다. 만든 직후 Blob URL을 없애면
            // 스크립트를 읽지 못해 곧바로 오류로 끝나므로, Worker를 끝낼 때 함께 없앤다.
            generateWorkerUrl = objectUrl;
            return worker;
        } catch (error) {
            URL.revokeObjectURL(objectUrl);
            throw error;
        }
    }

    /**
     * 오래 걸리는 작업 동안 화면 전체를 덮을 음영과 진행 표시를 만든다.
     * @returns {void}
     */
    function buildProgressOverlay() {
        const overlay = createElement('div', { className: 'puyow-tools-overlay' }, rootElement);
        overlay.hidden = true;
        const panel = createElement('div', { className: 'puyow-tools-overlay-panel' }, overlay);
        const bar = createElement('div', { className: 'puyow-tools-progress' }, panel);
        createElement('span', {}, bar);
        elements.overlayText = createElement('div', { className: 'puyow-tools-overlay-text', text: '' }, panel);
        elements.overlayStopButton = createElement('button', { text: translate('Stop'), attributes: { type: 'button' } }, panel);
        elements.overlay = overlay;
    }

    /** 음영 화면을 띄운다. @param {string} message 가운데에 보일 문구 @param {Function} onStop 중단 버튼을 눌렀을 때 할 일 @returns {void} */
    function openProgressOverlay(message, onStop) {
        elements.overlayText.textContent = message;
        elements.overlayStopButton.onclick = onStop;
        elements.overlay.hidden = false;
        elements.overlayStopButton.focus();
    }

    /** 음영 화면을 걷는다. @returns {void} */
    function closeProgressOverlay() {
        elements.overlay.hidden = true;
        elements.overlayStopButton.onclick = null;
    }

    /**
     * 뿌요 목록을 puyow.js가 쓰는 보드 배열로 만든다.
     * @param {{x:number,y:number,color:string}[]} puyos 뿌요 목록
     * @returns {(string|null)[][]} 검증용 보드
     */
    function buildVerificationBoard(puyos) {
        const board = Array.from({ length: GAME_BOARD_ROWS }, () => Array(AUTO_GENERATE_BOARD.columns).fill(null));
        puyos.forEach(({ x, y, color }) => {
            if (y < 0 || y >= GAME_BOARD_ROWS || x < 0 || x >= AUTO_GENERATE_BOARD.columns) return;
            board[y][x] = color;
        });
        return board;
    }

    /**
     * Worker가 찾은 배치를 게임 코드로 다시 확인한다.
     * Worker의 판정은 근사이므로, 실제로 쓸지 여부는 여기에서만 정한다.
     * @param {{x:number,y:number,color:string}[]} puyos Worker가 돌려준 배치
     * @param {string[]} pair 지급 뿌요 쌍
     * @param {number} target 목표 연쇄 수
     * @returns {boolean} 그대로 써도 되는지 여부
     */
    function verifyGeneratedFeverBoard(puyos, pair, target) {
        const api = getGameApi();
        const board = buildVerificationBoard(puyos);
        // 쌍을 놓기 전에 스스로 터지는 배치는 패턴으로 쓸 수 없다.
        if (api.findExplosionsOnBoard(board).length > 0) return false;
        const best = api.findBestPreviewResult(board, pair);
        return Boolean(best) && best.combo === target;
    }

    /** 돌고 있는 자동생성 Worker를 끝내고 음영 화면을 걷는다. @returns {void} */
    function stopAutoGenerate() {
        if (generateWorker) {
            generateWorker.terminate();
            generateWorker = null;
        }
        if (generateWorkerUrl) {
            URL.revokeObjectURL(generateWorkerUrl);
            generateWorkerUrl = null;
        }
        closeProgressOverlay();
    }

    /**
     * 피버 패턴의 플레이 영역을 목표 연쇄가 되도록 자동으로 채운다.
     * 이미 놓여 있는 뿌요와 "다음에 나올 뿌요"는 그대로 두고 필요한 만큼만 더한다.
     * @returns {void}
     */
    function startFeverAutoGenerate() {
        let stage = null;
        try {
            // 배치가 비어 있어도 자동생성은 할 수 있으므로 뿌요가 하나도 없는 것은 막지 않는다.
            stage = collectFeverStage({ requirePuyos: false });
        } catch (error) {
            finishAutoGenerate(translate('Auto generation failed: %1', error.message), 'error');
            return;
        }
        const before = stage.stageData.puyos.length;
        try {
            generateWorker = createAutoGenerateWorker();
        } catch (error) {
            finishAutoGenerate(translate('Auto generation failed: %1', error.message), 'error');
            return;
        }
        const worker = generateWorker;
        worker.onmessage = (event) => {
            const data = event.data || {};
            if (data.type === 'found') {
                if (!verifyGeneratedFeverBoard(data.puyos, stage.suppliedNextPuyos, stage.targetCombo)) {
                    worker.postMessage({ type: 'reject' });
                    return;
                }
                // 직전과 똑같은 배치면 다른 경우를 더 찾아본다.
                if (retryAutoGenerateForVariety(data.puyos, worker)) return;
                acceptAutoGenerateResult(data.puyos);
                finishAutoGenerate(translate('Auto generation finished. %1 puyos were added.', data.puyos.length - before), 'done');
                return;
            }
            stopAutoGenerate();
            if (data.type === 'unstable') {
                finishAutoGenerate(translate('Auto generation failed: %1', translate('The puyos already on the play field pop on their own.')), 'error');
                return;
            }
            if (data.type === 'overshoot') {
                finishAutoGenerate(translate('Auto generation failed: %1', translate('The puyos already on the play field make more chains than the target.')), 'error');
                return;
            }
            finishAutoGenerate(translate('Could not find a layout that makes exactly %1 chains. Try changing the colors in use or the puyos already placed.', stage.targetCombo), 'error');
        };
        worker.onerror = () => {
            stopAutoGenerate();
            finishAutoGenerate(translate('Auto generation failed: %1', translate('The background search stopped with an error.')), 'error');
        };
        openProgressOverlay(translate('Looking for a layout that makes exactly %1 chains...', stage.targetCombo), () => {
            stopAutoGenerate();
            finishAutoGenerate(translate('Auto generation stopped.'), 'error');
        });
        autoGenerateVarietyRetries = 0;
        worker.postMessage({
            type: 'start',
            puyos: stage.stageData.puyos,
            colors: stage.usingColors,
            pair: [...stage.suppliedNextPuyos],
            objective: { kind: 'combo', target: stage.targetCombo },
            timeLimit: AUTO_GENERATE_TIME_LIMIT,
            seed: createAutoGenerateSeed()
        });
    }


    /**
     * 게임 코드(`findExplosionGroupsOnBoard`, `collapseBoard`)로 연쇄를 한 단계씩 진행한다.
     * 목표 타입 multiple·color는 단계별 값이 필요한데 게임이 그 값을 따로 내보내지 않으므로,
     * 폭발 그룹 찾기와 중력만 게임 코드에 맡기고 진행 자체는 여기서 돌린다.
     * @param {(string|null)[][]} board 시작 보드
     * @returns {{steps:{popped:number, colors:number}[], board:(string|null)[][]}} 단계별 결과와 마지막 보드
     */
    function resolveBoardWithGameCode(board) {
        const api = getGameApi();
        let work = api.collapseBoard(board);
        const steps = [];
        for (;;) {
            const groups = api.findExplosionGroupsOnBoard(work);
            if (!groups.length) break;
            const next = work.map((row) => [...row]);
            groups.forEach(({ cells }) => cells.forEach(([x, y]) => {
                next[y][x] = null;
                // 폭발에 닿은 일반 방해뿌요도 함께 사라진다.
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= AUTO_GENERATE_BOARD.columns || ny < 0 || ny >= GAME_BOARD_ROWS) return;
                    if (work[ny][nx] === 'garbage') next[ny][nx] = null;
                });
            }));
            work = api.collapseBoard(next);
            steps.push({
                popped: groups.reduce((sum, group) => sum + group.cells.length, 0),
                colors: new Set(groups.map((group) => group.color)).size
            });
        }
        return { steps, board: work };
    }

    /**
     * 쌍을 놓을 수 있는 모든 자리를 게임 코드의 착지 계산으로 하나씩 돌려준다.
     * @param {(string|null)[][]} board 놓기 전 보드
     * @param {string[]} pair 지급 뿌요 쌍
     * @param {(placed:(string|null)[][], positions:{x:number,y:number}[]) => void} visit 자리마다 부를 함수
     * @returns {void}
     */
    function forEachPlacement(board, pair, visit) {
        const api = getGameApi();
        // 조작 뿌요가 나타나는 높이는 puyow.js의 ACTIVE_PUYO_SPAWN_Y와 같은 값이다.
        const virtualPlayer = { board, active: { x: 2, y: 11.9, rotation: 0, colors: [...pair] } };
        for (let rotation = 0; rotation < 4; rotation += 1) {
            for (let x = 0; x < AUTO_GENERATE_BOARD.columns; x += 1) {
                const placement = api.findLandingPlacement(virtualPlayer, x, rotation);
                if (!placement) continue;
                const cells = api.activeCells(placement);
                const placed = board.map((row) => [...row]);
                cells.forEach(({ x: cellX, y: cellY, color }) => { placed[cellY][cellX] = color; });
                visit(placed, cells.map(({ x: cellX, y: cellY }) => ({ x: cellX, y: cellY })));
            }
        }
    }

    /**
     * Worker가 찾은 퍼즐뿌요 배치를 게임 코드로 다시 확인한다.
     * 첫 턴에 목표를 이룰 수 있는지만 본다. 목표 턴수는 1 이상이므로 첫 턴 해법은 언제나 제한 안이다.
     * @param {{x:number,y:number,color:string}[]} puyos Worker가 돌려준 배치
     * @param {string[]} pair 첫 턴 지급 뿌요 쌍
     * @param {object} stage 편집 중인 PuzzlePuyoStage
     * @returns {boolean} 그대로 써도 되는지 여부
     */
    function verifyGeneratedPuzzleBoard(puyos, pair, stage) {
        const api = getGameApi();
        const board = buildVerificationBoard(puyos);
        if (api.findExplosionsOnBoard(board).length > 0) return false;
        let reached = false;
        forEachPlacement(board, pair, (placed, positions) => {
            if (reached) return;
            const resolved = resolveBoardWithGameCode(placed);
            if (!resolved.steps.length) return;
            if (stage.winConditionType === 'combo') reached = resolved.steps.length === stage.winConditionValue;
            else if (stage.winConditionType === 'clear') reached = api.isAllClearBoard(resolved.board);
            else if (stage.winConditionType === 'multiple') reached = resolved.steps.some((step) => step.popped >= stage.winConditionValue);
            else if (stage.winConditionType === 'color') reached = resolved.steps.some((step) => step.colors >= stage.winConditionValue);
            else if (stage.winConditionType === 'attack') {
                const result = api.simulatePlacementResult(board, pair, positions);
                reached = Boolean(result) && result.attack >= stage.winConditionValue;
            }
        });
        return reached;
    }

    /**
     * 퍼즐뿌요의 플레이 영역을 목표를 이룰 수 있도록 자동으로 채운다.
     * 이미 놓여 있는 뿌요와 "다음에 나올 뿌요", 목표 타입·값·턴수·힌트는 그대로 둔다.
     * @returns {void}
     */
    function startPuzzleAutoGenerate() {
        let stage = null;
        try {
            stage = collectPuzzleStage({ requirePuyos: false });
        } catch (error) {
            setStatus(translate('Auto generation failed: %1', error.message), 'error');
            return;
        }
        const pair = stage.suppliedNextPuyos[0];
        // 첫 턴 해법을 찾는 것이므로, 쓸 수 있는 색은 배치와 지급 뿌요에 나온 색과 기본 5색을 모두 본다.
        const colors = getToolsApi().getColors();
        const objective = stage.winConditionType === 'clear'
            ? { kind: 'clear', target: 1 }
            : { kind: stage.winConditionType, target: stage.winConditionValue };
        // attack 목표는 얕은 연쇄부터 시험한다. 실제 공격량 판정은 본래 쓰레드가 한다.
        if (objective.kind === 'attack') objective.target = 2;
        const before = stage.stageData.puyos.length;
        try {
            generateWorker = createAutoGenerateWorker();
        } catch (error) {
            finishAutoGenerate(translate('Auto generation failed: %1', error.message), 'error');
            return;
        }
        const worker = generateWorker;
        worker.onmessage = (event) => {
            const data = event.data || {};
            if (data.type === 'found') {
                if (!verifyGeneratedPuzzleBoard(data.puyos, pair, stage)) {
                    worker.postMessage({ type: 'reject' });
                    return;
                }
                // 직전과 똑같은 배치면 다른 경우를 더 찾아본다.
                if (retryAutoGenerateForVariety(data.puyos, worker)) return;
                acceptAutoGenerateResult(data.puyos);
                finishAutoGenerate(translate('Auto generation finished. %1 puyos were added.', data.puyos.length - before), 'done');
                return;
            }
            stopAutoGenerate();
            if (data.type === 'unstable') {
                finishAutoGenerate(translate('Auto generation failed: %1', translate('The puyos already on the play field pop on their own.')), 'error');
                return;
            }
            if (data.type === 'overshoot') {
                finishAutoGenerate(translate('Auto generation failed: %1', translate('The puyos already on the play field make more chains than the target.')), 'error');
                return;
            }
            finishAutoGenerate(translate('Could not find a layout that reaches the goal. Try changing the goal or the puyos already placed.'), 'error');
        };
        worker.onerror = () => {
            stopAutoGenerate();
            finishAutoGenerate(translate('Auto generation failed: %1', translate('The background search stopped with an error.')), 'error');
        };
        openProgressOverlay(translate('Looking for a layout that reaches the goal on the first turn...'), () => {
            stopAutoGenerate();
            finishAutoGenerate(translate('Auto generation stopped.'), 'error');
        });
        autoGenerateVarietyRetries = 0;
        worker.postMessage({
            type: 'start',
            puyos: stage.stageData.puyos,
            colors,
            pair: [...pair],
            objective,
            timeLimit: AUTO_GENERATE_TIME_LIMIT,
            seed: createAutoGenerateSeed()
        });
    }

    /** 지금 개발 대상에 맞는 자동생성을 시작한다. @returns {void} */
    function startAutoGenerate() {
        if (currentMode === 'fever') startFeverAutoGenerate();
        else if (currentMode === 'puzzle') startPuzzleAutoGenerate();
    }


    /**
     * WebMCP에 노출할 도구 이름 앞에 붙이는 말이다.
     * puyow.js도 같은 문서에 도구를 등록하므로 이름이 겹치지 않게 한다.
     * @type {string}
     */
    const TOOLS_MCP_PREFIX = 'tools_';

    /** 등록한 WebMCP 도구를 한 번에 해제하는 컨트롤러다. @type {AbortController|null} */
    let mcpAbortController = null;

    /** 편집 화면이 준비되어 있는지 확인하고, 아니면 예외를 던진다. @returns {void} */
    function requireEditor() {
        if (!currentMode) throw new Error('Choose what to develop first with tools_select_mode.');
        if (testing) throw new Error('A test is running. Finish or stop it first.');
    }

    /**
     * 지금 편집 상태를 WebMCP 응답용 객체로 만든다.
     * @returns {object} 화면 상태
     */
    function readMcpStatus() {
        const editor = currentMode ? getToolsApi().getEditorData() : null;
        const status = {
            mode: currentMode || 'none',
            language: toolsLanguage,
            darkMode: toolsSettings.darkMode,
            testing,
            verified: verifiedSnapshot !== null && verifiedSnapshot === (currentMode ? buildVerificationSnapshot() : null),
            message: elements.status ? elements.status.textContent : '',
            script: elements.output ? elements.output.value : '',
            puyos: editor ? editor.stageData.puyos : [],
            nextPuyos: editor ? editor.nextPuyos : [],
            fever: null,
            puzzle: null
        };
        if (currentMode === 'fever') {
            status.fever = {
                targetCombo: Number(elements.targetCombo.value) || 0,
                difficulty: Number(elements.difficulty.value) || 0,
                usingColors: readUsingColorValues()
            };
        } else if (currentMode === 'puzzle') {
            status.puzzle = {
                winConditionType: elements.winConditionType.value,
                winConditionValue: Number(elements.winConditionValue.value) || 0,
                turnLimit: Number(elements.turnLimit.value) || 0,
                hint: elements.hint.value
            };
        }
        return status;
    }

    /**
     * 플레이 영역의 뿌요를 바꾼다.
     * @param {{puyos?:{x:number,y:number,color:string}[], remove?:{x:number,y:number}[], clearFirst?:boolean}} input 바꿀 내용
     * @returns {string} 결과 문구
     */
    function applyMcpPuyos(input) {
        requireEditor();
        const editor = readEditorData(false);
        const board = new Map();
        if (!input.clearFirst) editor.stageData.puyos.forEach((puyo) => board.set(`${puyo.x},${puyo.y}`, puyo));
        (input.remove || []).forEach(({ x, y }) => board.delete(`${x},${y}`));
        (input.puyos || []).forEach(({ x, y, color }) => {
            if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('x and y must be integers.');
            if (x < 0 || x >= AUTO_GENERATE_BOARD.columns) throw new Error(`x must be from 0 to ${AUTO_GENERATE_BOARD.columns - 1}.`);
            if (y < 0 || y >= AUTO_GENERATE_BOARD.rows) throw new Error(`y must be from 0 to ${AUTO_GENERATE_BOARD.rows - 1}.`);
            if (!COLORS.includes(color) && color !== 'garbage') throw new Error(`"${color}" cannot be placed on the play field.`);
            board.set(`${x},${y}`, { x, y, color });
        });
        getToolsApi().setEditorData({ stageData: { puyos: [...board.values()] } });
        return `The play field now has ${board.size} puyos.`;
    }

    /**
     * "다음에 나올 뿌요" 칸을 바꾼다.
     * @param {{turns:(string|null)[][]}} input 턴별 색 목록
     * @returns {string} 결과 문구
     */
    function applyMcpNextPuyos(input) {
        requireEditor();
        const maxTurns = currentMode === 'fever' ? 1 : getToolsApi().getMaxNextTurns();
        const turns = Array.isArray(input.turns) ? input.turns : [];
        if (turns.length > maxTurns) throw new Error(`This mode accepts at most ${maxTurns} turns of next puyos.`);
        turns.forEach((pair, index) => {
            if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`Turn ${index + 1} must be an array of two colors.`);
            pair.forEach((color) => {
                if (color !== null && !COLORS.includes(color)) throw new Error(`"${color}" cannot be placed in the next puyos.`);
            });
        });
        getToolsApi().setEditorData({ suppliedNextPuyos: currentMode === 'fever' ? (turns[0] || [null, null]) : turns });
        return `The next puyos now have ${turns.length} turns.`;
    }

    /**
     * 사이드바 입력값을 바꾼다.
     * @param {object} input 바꿀 값
     * @returns {string} 결과 문구
     */
    function applyMcpOptions(input) {
        requireEditor();
        if (currentMode === 'fever') {
            if (input.targetCombo !== undefined) elements.targetCombo.value = String(input.targetCombo);
            if (input.difficulty !== undefined) elements.difficulty.value = String(input.difficulty);
            if (Array.isArray(input.usingColors)) {
                input.usingColors.forEach((color) => {
                    if (!COLORS.includes(color)) throw new Error(`"${color}" is not a usable color.`);
                });
                setUsingColorRows(input.usingColors);
            }
        } else {
            if (input.winConditionType !== undefined) {
                if (!WIN_CONDITION_TYPES.some((type) => type.value === input.winConditionType)) {
                    throw new Error(`"${input.winConditionType}" is not a win condition type.`);
                }
                elements.winConditionType.value = input.winConditionType;
                refreshWinConditionValueState();
            }
            if (input.winConditionValue !== undefined) elements.winConditionValue.value = String(input.winConditionValue);
            if (input.turnLimit !== undefined) elements.turnLimit.value = String(input.turnLimit);
            if (input.hint !== undefined) elements.hint.value = String(input.hint);
        }
        return 'The sidebar values were updated.';
    }

    /**
     * WebMCP에 도구 페이지 전용 도구를 등록한다. 미지원 브라우저에서는 아무 일도 하지 않는다.
     * 게임 본체도 같은 문서에 도구를 등록하므로 이름 앞에 tools_ 를 붙여 구분한다.
     * @returns {void}
     */
    function registerMcpTools() {
        if (!document.modelContext || typeof document.modelContext.registerTool !== 'function') return;
        mcpAbortController = new AbortController();
        const emptyInput = { type: 'object', properties: {}, additionalProperties: false };
        const colorEnum = { type: 'string', enum: [...COLORS] };
        const cellSchema = {
            type: 'object',
            properties: {
                x: { type: 'integer', minimum: 0, maximum: AUTO_GENERATE_BOARD.columns - 1 },
                y: { type: 'integer', minimum: 0, maximum: AUTO_GENERATE_BOARD.rows - 1 }
            },
            required: ['x', 'y'],
            additionalProperties: false
        };
        const tools = [
            {
                name: `${TOOLS_MCP_PREFIX}manual`,
                description: 'Return English instructions for building FEVER patterns and Puzzle Puyo stages with the Puyo W dev tools page.',
                inputSchema: emptyInput,
                execute: () => [
                    'This page builds FEVER patterns and Puzzle Puyo stages for Puyo W and prints the source code for them.',
                    'Start with tools_select_mode, then edit the play field with tools_place_puyos and the supplied pairs with tools_set_next_puyos.',
                    'The play field is 6 columns wide and 13 rows tall; y = 0 is the bottom row. Colors are red, green, yellow, blue and purple, plus garbage on the play field only.',
                    'tools_set_options changes the sidebar values: target chain, difficulty and colors in use for FEVER; win condition, value, turn limit and hint for Puzzle Puyo.',
                    'tools_auto_generate fills the play field so that the goal becomes reachable, keeping every puyo that is already placed. It can take up to two minutes.',
                    'tools_generate_script only works after a successful test, and a person has to play that test with the keyboard: tools_run_test starts it and tools_stop_test ends it.',
                    'tools_status reports the current mode, sidebar values, board, whether a test is running and whether the current content has passed a test.'
                ].join(' ')
            },
            {
                name: `${TOOLS_MCP_PREFIX}status`,
                description: 'Get the current dev tools state: chosen mode, sidebar values, play field puyos, next puyos, test state, whether the current content passed a test, the last status message and the generated script.',
                inputSchema: emptyInput,
                execute: () => readMcpStatus()
            },
            {
                name: `${TOOLS_MCP_PREFIX}select_mode`,
                description: 'Choose what to develop. Use "fever" for a FEVER pattern or "puzzle" for a Puzzle Puyo stage.',
                inputSchema: {
                    type: 'object',
                    properties: { kind: { type: 'string', enum: ['fever', 'puzzle'] } },
                    required: ['kind'],
                    additionalProperties: false
                },
                execute: ({ kind }) => {
                    selectMode(kind);
                    return `Now editing: ${kind}.`;
                }
            },
            {
                name: `${TOOLS_MCP_PREFIX}load_script`,
                description: 'Load an existing pattern or stage from source code written as new FeverStageState(...) or new PuzzlePuyoStage({...}). The matching mode is chosen automatically.',
                inputSchema: {
                    type: 'object',
                    properties: { script: { type: 'string', description: 'The source code to load.' } },
                    required: ['script'],
                    additionalProperties: false
                },
                execute: ({ script }) => {
                    applyLoadedStage(parseStageScript(script));
                    return 'The existing data was loaded into the editor.';
                }
            },
            {
                name: `${TOOLS_MCP_PREFIX}set_options`,
                description: 'Set the sidebar values of the current mode. FEVER accepts targetCombo, difficulty and usingColors; Puzzle Puyo accepts winConditionType, winConditionValue, turnLimit and hint. Values that are left out keep their current value.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        targetCombo: { type: 'integer', minimum: FEVER_TARGET_COMBO_MIN, maximum: FEVER_TARGET_COMBO_MAX },
                        difficulty: { type: 'integer', minimum: 1 },
                        usingColors: { type: 'array', items: colorEnum, minItems: FEVER_USING_COLOR_MIN, maxItems: FEVER_USING_COLOR_MAX },
                        winConditionType: { type: 'string', enum: WIN_CONDITION_TYPES.map((type) => type.value) },
                        winConditionValue: { type: 'integer', minimum: 1 },
                        turnLimit: { type: 'integer', minimum: PUZZLE_TURN_LIMIT_MIN, maximum: PUZZLE_TURN_LIMIT_MAX },
                        hint: { type: 'string' }
                    },
                    additionalProperties: false
                },
                execute: (input) => applyMcpOptions(input)
            },
            {
                name: `${TOOLS_MCP_PREFIX}place_puyos`,
                description: 'Place or remove puyos on the play field. y = 0 is the bottom row. Set clearFirst to true to start from an empty field; remove lists cells to erase before placing.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        puyos: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    x: { type: 'integer', minimum: 0, maximum: AUTO_GENERATE_BOARD.columns - 1 },
                                    y: { type: 'integer', minimum: 0, maximum: AUTO_GENERATE_BOARD.rows - 1 },
                                    color: { type: 'string', enum: [...COLORS, 'garbage'] }
                                },
                                required: ['x', 'y', 'color'],
                                additionalProperties: false
                            }
                        },
                        remove: { type: 'array', items: cellSchema },
                        clearFirst: { type: 'boolean', default: false }
                    },
                    additionalProperties: false
                },
                execute: (input) => applyMcpPuyos(input)
            },
            {
                name: `${TOOLS_MCP_PREFIX}set_next_puyos`,
                description: 'Set the supplied pairs shown as "Next Puyos". Each turn is an array of two colors, and the first color is the lower puyo. A FEVER pattern takes one turn, a Puzzle Puyo stage up to six.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        turns: {
                            type: 'array',
                            items: { type: 'array', items: colorEnum, minItems: 2, maxItems: 2 }
                        }
                    },
                    required: ['turns'],
                    additionalProperties: false
                },
                execute: (input) => applyMcpNextPuyos(input)
            },
            {
                name: `${TOOLS_MCP_PREFIX}auto_generate`,
                description: 'Fill the play field so the goal of the current mode becomes reachable, keeping the puyos that are already placed and adding as few as possible. Waits until the search finishes, which can take up to two minutes, and returns the result message.',
                inputSchema: emptyInput,
                execute: () => {
                    requireEditor();
                    if (generateWorker) throw new Error('Auto generation is already running.');
                    const waiting = new Promise((resolve) => { autoGenerateWaiters.push(resolve); });
                    startAutoGenerate();
                    return waiting;
                }
            },
            {
                name: `${TOOLS_MCP_PREFIX}run_test`,
                description: 'Start a test of the current content in the real game. A person must play it with the keyboard, so this returns as soon as the test starts. Poll tools_status for the result, or call tools_stop_test to end it.',
                inputSchema: emptyInput,
                execute: () => {
                    const started = runTest();
                    return started.message;
                }
            },
            {
                name: `${TOOLS_MCP_PREFIX}stop_test`,
                description: 'End a running test and go back to the editor.',
                inputSchema: emptyInput,
                execute: () => {
                    if (!testing) return 'No test is running.';
                    getToolsApi().stopTest();
                    return 'The test was stopped.';
                }
            },
            {
                name: `${TOOLS_MCP_PREFIX}generate_script`,
                description: 'Print the source code for the current content. It only works when a test of exactly this content has already succeeded.',
                inputSchema: emptyInput,
                execute: () => {
                    requireEditor();
                    generateScript();
                    if (!elements.output.value) throw new Error(elements.status.textContent);
                    return elements.output.value;
                }
            }
        ];
        tools.forEach((tool) => {
            try {
                Promise.resolve(document.modelContext.registerTool(tool, { signal: mcpAbortController.signal }))
                    .catch((error) => console.error('WebMCP tool registration failed.', error));
            } catch (error) {
                console.error('WebMCP tool registration failed.', error);
            }
        });
    }

    /**
     * 게임 캔버스를 캔버스 영역 안에서 16 : 9 비율로 맞춘다.
     * puyow.js의 실행용 레이아웃은 화면 전체 기준이라 도구 화면에서는 여기서 직접 크기를 정한다.
     * @returns {void}
     */
    function resizeCanvasRoot() {
        if (!elements.canvasHost || !elements.canvasRoot || elements.right.hidden) return;
        const style = window.getComputedStyle(elements.canvasHost);
        const width = elements.canvasHost.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const height = elements.canvasHost.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        if (!(width > 0) || !(height > 0)) return;
        const scale = Math.min(width / 1280, height / 720);
        elements.canvasRoot.style.width = `${Math.floor(1280 * scale)}px`;
        elements.canvasRoot.style.height = `${Math.floor(720 * scale)}px`;
    }

    /** 캔버스 영역의 크기 변화를 지켜보며 게임 화면 크기를 다시 맞춘다. @returns {void} */
    function observeCanvasSize() {
        if (typeof ResizeObserver !== 'function') return;
        canvasResizeObserver = new ResizeObserver(() => resizeCanvasRoot());
        canvasResizeObserver.observe(elements.canvasHost);
    }

    /**
     * 개발용 도구 화면을 지정한 요소 안에 만든다.
     * @param {HTMLElement|string} target 도구를 넣을 요소 또는 그 id
     * @returns {void}
     */
    function initialize(target) {
        if (rootElement) return;
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (!element) throw new Error(translate('Could not find the element to build the dev tools in.'));
        toolsLanguage = detectToolsLanguage();
        loadToolsSettings();
        rootElement = element;
        // 게임을 만들기 전에 등록해야 편집 화면 canvas 문구도 같은 언어로 나온다.
        registerToolsCanvasLanguages();
        prepareStyle();
        buildLayout();
        applyToolsSettings();
        registerMcpTools();
        if (window.innerWidth < window.innerHeight) {
            setStatus(translate('Use a screen that is wider than it is tall.'), 'error');
        }
    }

    /**
     * 개발용 도구 화면을 해제한다.
     * @returns {void}
     */
    function destroy() {
        if (!rootElement) return;
        stopAutoGenerate();
        if (mcpAbortController) mcpAbortController.abort();
        mcpAbortController = null;
        window.removeEventListener('resize', resizeCanvasRoot);
        rootElement.removeEventListener('keydown', stopKeyEventForFormField);
        canvasResizeObserver?.disconnect();
        canvasResizeObserver = null;
        document.body.classList.remove('puyow-tools-light');
        if (gameInitialized) getGameApi().destroy();
        gameInitialized = false;
        rootElement.classList.remove('puyow-tools');
        rootElement.textContent = '';
        rootElement = null;
        currentMode = null;
        testing = false;
        verifiedSnapshot = null;
        Object.keys(elements).forEach((key) => { delete elements[key]; });
    }

    window.PuyoWTools = { initialize, destroy };
})();
