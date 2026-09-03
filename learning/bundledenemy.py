# puyow.js 기본 탑재 적 알고리즘 구현 파트 (학습의 상대방 역할을 위함)
#
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.

"""src/js/puyow.js의 BundledEnemy 계열 적 AI를 Python으로 포팅한 모듈이다.

learning.py의 self-play 학습에서 "빈 상대" 대신 실제 게임에 탑재된 적들과 대전하며
학습할 수 있도록, 각 적의 판단 알고리즘(chooseTarget/chooseRotate/prepareTurn)을
puyow.js와 최대한 같은 결과가 나오도록 옮겼다. 사용자 요청에 따라 솔로몬(외부 AI
API 호출 전용)과 안드로말리우스는 이식 대상에서 제외했다.

## 이식 범위와 단순화한 부분

이 포팅은 학습 환경(common.py)이 이미 정한 계약을 따른다. 즉, 화면에 보이는
12행(BOARD_HEIGHT)만 있는 보드를 사용하며, puyow.js가 갖는 화면 위 숨김 13행
(ROWS=25 중 VISIBLE_ROWS=12를 제외한 나머지)은 재현하지 않는다. 따라서 죽음 칸이
아닌 열을 화면 밖 높이까지 쌓아 올리는 극단적인 경우의 동작은 원작과 다를 수 있다.
그 밖에 다음도 학습 환경의 범위 밖이라 이식하지 않았다:

* 피버 룰/연속 피버 전용 분기(`game.feverRule`, `player.fever`)와 두 번째 죽음 칸(X=3).
  이 모듈은 기본 룰만 다루므로 관련 분기는 모두 "피버 아님"으로 고정된 경우와 동일하다.
* 딱딱뿌요(hardGarbage)·철구뿌요(iron)는 시뮬레이터 전용이므로 제외했다. 방해뿌요
  (GARBAGE)는 지원한다.
* `shouldCounterPlayerChain`(상대가 실시간으로 연쇄를 진행 중일 때 끼어드는 판단)은
  순서대로 수를 두는 턴제 학습 환경에는 대응되는 개념이 없어 제외했다.
* 안드레알푸스의 3수 탐색은 원작에서 Blob Worker로 비동기 수행하지만, 이 모듈은
  오프라인 학습 스크립트에서 동기적으로 실행한다(find_best_n_move_placement 재사용).
  시간 제한 대신 항상 완전 탐색을 수행하므로 원작보다 느릴 수 있다.
* 키마리스는 원작에서 chooseRotate()를 재정의하지 않기 때문에, 2수 탐색이 옆으로
  눕는 배치를 골라도 실제로는 항상 세로(회전 0)로 놓는다. 이 별난 동작은 실제
  puyow.js의 동작이므로 "버그 수정" 없이 그대로 재현했다(Kimaris._choose 참고).

각 적은 `decide(board, colors, next_pairs, incoming_garbage)`를 호출하면 이번 수의
열·회전·착지 좌표·예상 연쇄/ATTACK을 담은 Placement를 돌려준다. 여러 턴에 걸친 판단
(단탈리온의 진행 단계, 세레의 주기 등)은 적 인스턴스에 상태로 보관되므로, 같은 대전
동안에는 같은 인스턴스를 계속 재사용해야 한다.
"""

import math
import random
import time
from typing import Callable, List, Optional, Sequence, Tuple

from common import BOARD_HEIGHT, BOARD_WIDTH, ROTATION_COUNT, ROTATION_UP

# 보드 셀 값: 색 뿌요는 0..COLORS-1, 빈 칸은 EMPTY, 방해뿌요는 GARBAGE다.
EMPTY = -1
GARBAGE = -2

# puyow.js activeCells()의 [dx, dy] 회전 오프셋 표. 인덱스는 common.py의 ROTATION_* 값과 같다.
ROTATION_OFFSETS = ((0, 1), (1, 0), (0, -1), (-1, 0))

# 화면에 보이는 행 수. 이 포팅은 숨김 행을 두지 않으므로 BOARD_HEIGHT와 같다.
VISIBLE_ROWS = BOARD_HEIGHT
# 조작 뿌요가 스폰되는 열. puyow.js의 기본 스폰 X=2에 대응한다.
SPAWN_X = 2

# 패배 칸(기본 룰 기준 X=2, Y=11)과 적 AI가 미리 피하는 경고 행(Y=8)이다.
DEFEAT_COLUMN = 2
DEFEAT_ROW = BOARD_HEIGHT - 1
AVOIDANCE_WARNING_ROW = 8
# 공격 시뮬레이션을 우선하게 만드는 트리거 칸이다(puyow.js attackSimulationTriggerPosition).
ATTACK_TRIGGER_X = 2
ATTACK_TRIGGER_Y = 8
# 이 이상 예고된 방해뿌요가 쌓이면 연쇄 크기와 관계없이 즉시 공격을 최우선한다.
AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD = 12

DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))

# puyow.js의 점수 계산 상수. 학습 환경은 게임 경과 시간에 따른 마진 레이트·시간 배율
# 변화를 두지 않으므로, 항상 시작 값(마진 레이트 70, 시간 배율 1)을 사용한다.
CHAIN_BONUS = (0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512)
CONNECTION_BONUS = (0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10)
COLOR_BONUS = (0, 0, 3, 6, 12, 24)
MARGIN_RATE = 70
EXPLOSION_REWARD_MULTIPLIER = 1


class Placement:
    """한 수의 열·회전·착지 좌표와 예상 연쇄·ATTACK을 담는다. puyow.js의 aiSimulations 항목에 대응한다."""

    __slots__ = ("x", "rotation", "positions", "attack", "combo", "all_clear", "preview_combo", "preview_attack")

    def __init__(self, x: int, rotation: int, positions: List[Tuple[int, int]], attack: float, combo: int):
        """열·회전·착지 좌표·예상 ATTACK·예상 연쇄 수로 배치 후보 하나를 만든다."""
        self.x = x
        self.rotation = rotation
        self.positions = positions
        self.attack = attack
        self.combo = combo
        self.all_clear = False
        self.preview_combo = 0
        self.preview_attack = 0.0


class NMovePlan:
    """N수 탐색 한 경로의 평가 결과다. puyow.js의 findBestNMoveBoardResult 반환값에 대응한다."""

    def __init__(self, x, rotation, positions, board, combo, attack, all_clear, max_combo, total_attack, score, next_result, simulation=None):
        """이번 수의 결과 보드와 이후 수까지 이어지는 평가값(점수·최대 연쇄·누적 ATTACK)을 담는다."""
        self.x = x
        self.rotation = rotation
        self.positions = positions
        self.board = board
        self.combo = combo
        self.attack = attack
        self.all_clear = all_clear
        self.max_combo = max_combo
        self.total_attack = total_attack
        self.score = score
        self.next_result = next_result
        self.simulation = simulation
        # 키마리스/안드레알푸스의 방해뿌요 상쇄 우선순위 판단이 채워 넣는 값이다.
        self.remaining_incoming = 0.0
        self.unresolved_danger = False


# ---------------------------------------------------------------------------
# 보드 시뮬레이션 공통 함수 (puyow.js의 착지·폭발·중력·점수 계산 함수에 대응)
# ---------------------------------------------------------------------------

def new_empty_board() -> List[List[int]]:
    """빈 칸으로만 채워진 새 보드를 만든다."""
    return [[EMPTY for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]


def copy_board(board: Sequence[Sequence[int]]) -> List[List[int]]:
    """보드를 얕은 복사한다(각 행은 새 리스트로 복사되므로 원본을 바꾸지 않는다)."""
    return [list(row) for row in board]


def is_board_empty(board: Sequence[Sequence[int]]) -> bool:
    """모든 칸이 빈 칸인지 확인한다."""
    return all(cell == EMPTY for row in board for cell in row)


def is_all_clear_board(board: Sequence[Sequence[int]]) -> bool:
    """싹쓸이(보드 전체가 빈 칸) 상태인지 확인한다. puyow.js의 isAllClearBoard에 대응한다."""
    return is_board_empty(board)


def is_defeat_board(board: Sequence[Sequence[int]]) -> bool:
    """기본 룰의 패배 칸(X=2, Y=11)만 검사한다. 피버 룰의 두 번째 죽음 칸(X=3)은 이 포팅의 범위 밖이다."""
    return board[DEFEAT_ROW][DEFEAT_COLUMN] != EMPTY


def collapse_board(board: Sequence[Sequence[int]]) -> List[List[int]]:
    """각 열을 아래로 압축해 뜬 칸을 없앤 새 보드를 반환한다. puyow.js의 collapseBoard에 대응한다."""
    collapsed = new_empty_board()
    for x in range(BOARD_WIDTH):
        target_y = 0
        for y in range(BOARD_HEIGHT):
            if board[y][x] != EMPTY:
                collapsed[target_y][x] = board[y][x]
                target_y += 1
    return collapsed


def find_explosion_groups(board: Sequence[Sequence[int]]) -> List[Tuple[int, List[Tuple[int, int]]]]:
    """상하좌우로 4개 이상 연결된 같은 색 뿌요 그룹을 찾는다. 방해뿌요·빈 칸은 그룹을 이루지 않는다."""
    visited = set()
    groups: List[Tuple[int, List[Tuple[int, int]]]] = []
    for y in range(VISIBLE_ROWS):
        for x in range(BOARD_WIDTH):
            color = board[y][x]
            if color < 0 or (x, y) in visited:
                continue
            stack = [(x, y)]
            visited.add((x, y))
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for dx, dy in DIRECTIONS:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < BOARD_WIDTH and 0 <= ny < VISIBLE_ROWS and board[ny][nx] == color and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        stack.append((nx, ny))
            if len(cells) >= 4:
                groups.append((color, cells))
    return groups


def resolve_explosion_step(board: Sequence[Sequence[int]], groups: Sequence[Tuple[int, List[Tuple[int, int]]]]) -> set:
    """폭발한 색 뿌요와 그에 인접한 방해뿌요의 좌표 집합을 구한다. 딱딱뿌요는 이 포팅의 범위 밖이다."""
    removed = set()
    for _color, cells in groups:
        removed.update(cells)
    for _color, cells in groups:
        for x, y in cells:
            for dx, dy in DIRECTIONS:
                nx, ny = x + dx, y + dy
                if 0 <= nx < BOARD_WIDTH and 0 <= ny < BOARD_HEIGHT and board[ny][nx] == GARBAGE:
                    removed.add((nx, ny))
    return removed


def get_chain_bonus(combo: int) -> float:
    """연쇄 수에 맞는 점수 보너스를 구한다. puyow.js의 getChainBonus에 대응한다."""
    if combo < len(CHAIN_BONUS):
        return CHAIN_BONUS[max(0, combo)]
    return CHAIN_BONUS[-1] * (combo - 18)


def get_connection_bonus(puyo_count: int) -> float:
    """한 폭발 단계에서 사라진 같은 색 뿌요 수에 맞는 점수 보너스를 구한다. puyow.js의 getConnectionBonus에 대응한다."""
    return CONNECTION_BONUS[min(max(0, puyo_count), len(CONNECTION_BONUS) - 1)]


def get_color_bonus(color_count: int) -> float:
    """동시에 폭발한 색 수에 맞는 점수 보너스를 구한다. puyow.js의 getColorBonus에 대응한다."""
    if color_count < len(COLOR_BONUS):
        return COLOR_BONUS[max(0, color_count)]
    return COLOR_BONUS[-1] + color_count - 5


def calculate_explosion_point(groups: Sequence[Tuple[int, List[Tuple[int, int]]]], combo: int) -> float:
    """한 폭발 단계의 점수 증가량을 계산한다. puyow.js의 calculateExplosionPoint에 대응한다(딱딱뿌요 배율은 제외)."""
    puyo_count = sum(len(cells) for _color, cells in groups)
    color_counts = {}
    for color, cells in groups:
        color_counts[color] = color_counts.get(color, 0) + len(cells)
    largest_color_count = max(color_counts.values()) if color_counts else 0
    connection_bonus = get_connection_bonus(largest_color_count)
    color_bonus = get_color_bonus(len(color_counts))
    bonus = max(1, get_chain_bonus(combo) + connection_bonus + color_bonus)
    return puyo_count * bonus * 10


def calculate_explosion_attack(point: float) -> float:
    """점수 증가량을 ATTACK 증가량으로 환산한다. puyow.js의 calculateExplosionAttack에 대응하며, 마진 레이트·시간 배율은 항상 시작값으로 고정한다."""
    return point / MARGIN_RATE * EXPLOSION_REWARD_MULTIPLIER


def _place_and_resolve(board: Sequence[Sequence[int]], colors: Sequence[int], positions: Optional[Sequence[Tuple[int, int]]]):
    """두 뿌요를 놓고 연쇄를 끝까지 해소한다. (안정 보드 또는 None, 연쇄 수, 누적 ATTACK)을 반환한다."""
    if positions is None or colors is None or len(colors) != 2 or len(positions) != 2:
        return None, 0, 0.0
    working = copy_board(board)
    for (x, y), color in zip(positions, colors):
        if not (0 <= x < BOARD_WIDTH and 0 <= y < BOARD_HEIGHT) or working[y][x] != EMPTY:
            return None, 0, 0.0
        working[y][x] = color
    working = collapse_board(working)
    combo = 0
    attack = 0.0
    while True:
        groups = find_explosion_groups(working)
        if not groups:
            break
        combo += 1
        removed = resolve_explosion_step(working, groups)
        point = calculate_explosion_point(groups, combo)
        attack += calculate_explosion_attack(point)
        for x, y in removed:
            working[y][x] = EMPTY
        working = collapse_board(working)
    return working, combo, attack


def resolve_placement(board, colors, positions) -> Tuple[Optional[List[List[int]]], int, float]:
    """`_place_and_resolve`의 공개 별칭이다. 학습 환경이 한 수를 두고 연쇄를 해소할 때 사용한다."""
    return _place_and_resolve(board, colors, positions)


def drop_garbage(board: Sequence[Sequence[int]], pending_damage: float, rng: random.Random) -> Tuple[List[List[int]], int]:
    """puyow.js의 dropGarbage에 대응한다. 누적 피해량만큼(최대 30개) 방해뿌요를 보드 위에 떨어뜨린다.

    원작은 화면 위 숨김 행에서 열 순서를 섞어 방해뿌요를 생성한 뒤 중력으로 착지시키지만,
    이 포팅은 숨김 행이 없으므로 셔플한 열 순서대로 각 열의 현재 높이 위에 바로 쌓는다.
    이미 가득 찬 열에 배정된 방해뿌요는 사라진다(이 포팅이 다루지 않는 숨김 행 대신 들어갈 자리이므로).
    반환값은 (갱신된 보드, 실제로 소비한 피해량)이다.
    """
    amount = min(30, math.floor(max(0.0, pending_damage)))
    if amount <= 0:
        return copy_board(board), 0
    waves = math.ceil(amount / BOARD_WIDTH)
    columns_order: List[int] = []
    for _ in range(waves):
        columns = list(range(BOARD_WIDTH))
        rng.shuffle(columns)
        columns_order.extend(columns)
    working = copy_board(board)
    for x in columns_order[:amount]:
        height = sum(1 for y in range(BOARD_HEIGHT) if working[y][x] != EMPTY)
        if height < BOARD_HEIGHT:
            working[height][x] = GARBAGE
    return working, amount


def simulate_placement_board(board, colors, positions) -> Optional[List[List[int]]]:
    """두 뿌요를 놓고 연쇄를 끝까지 해소한 안정 상태 보드만 반환한다. puyow.js의 simulatePlacementBoard에 대응한다."""
    result, _combo, _attack = _place_and_resolve(board, colors, positions)
    return result


def estimate_combo(board, colors, positions) -> int:
    """두 뿌요를 가상 배치했을 때 발생할 연쇄 수를 계산한다. puyow.js의 estimateCombo에 대응한다."""
    _result, combo, _attack = _place_and_resolve(board, colors, positions)
    return combo


def estimate_attack(board, colors, positions) -> float:
    """두 뿌요를 가상 배치했을 때 발생할 ATTACK 합계를 계산한다. puyow.js의 estimateAttack에 대응한다."""
    _result, _combo, attack = _place_and_resolve(board, colors, positions)
    return attack


def causes_immediate_defeat(board, colors, positions) -> bool:
    """이 배치가 연쇄·중력 정산 뒤 즉시 패배로 이어지는지 확인한다. puyow.js의 causesImmediateDefeat에 대응한다."""
    result, _combo, _attack = _place_and_resolve(board, colors, positions)
    if result is None:
        return True
    return is_defeat_board(result)


def _column_height(board: Sequence[Sequence[int]], x: int) -> int:
    """열 x에 쌓인 뿌요(색·방해뿌요 모두 포함) 수, 즉 다음에 놓일 칸의 y좌표를 구한다."""
    return sum(1 for y in range(BOARD_HEIGHT) if board[y][x] != EMPTY)


def find_landing_placement(board: Sequence[Sequence[int]], x: int, rotation: int) -> Optional[Tuple[Tuple[int, int], Tuple[int, int]]]:
    """puyow.js의 findLandingPlacement에 대응한다. 두 칸이 착지하는 좌표를 구한다.

    puyow.js는 스폰 위치(화면 위 숨김 행)에서 두 칸이 함께 내려가다 막히는 지점을 찾지만,
    이 포팅은 숨김 행이 없는 12행 보드만 쓰므로 그 방식은 위 회전(같은 열에서 축 뿌요보다
    한 칸 위)일 때 스폰 지점 자체가 보드 밖이 되어 버린다. 대신 각 칸을 자신이 속한 열의
    현재 높이 위에 놓는 방식을 쓴다. 착지 직후 `collapse_board`가 항상 다시 호출되어 뜬 칸을
    바닥까지 내리므로, 가로 배치에서 두 열의 높이가 다르더라도(원작처럼 나란히 붙어 내려가지
    않아도) 중력 정산 뒤 결과는 같다.
    """
    dx, dy = ROTATION_OFFSETS[rotation]
    second_x = x + dx
    if not (0 <= x < BOARD_WIDTH and 0 <= second_x < BOARD_WIDTH):
        return None

    if dx == 0:
        # 세로 배치(위/아래 회전): 같은 열에 두 칸을 쌓는다.
        height = _column_height(board, x)
        if height + 1 >= BOARD_HEIGHT:
            return None
        bottom, top = (x, height), (x, height + 1)
        return (bottom, top) if dy > 0 else (top, bottom)

    # 가로 배치(오른쪽/왼쪽 회전): 각 열의 현재 높이 위에 놓는다.
    pivot_height = _column_height(board, x)
    second_height = _column_height(board, second_x)
    if pivot_height >= BOARD_HEIGHT or second_height >= BOARD_HEIGHT:
        return None
    return (x, pivot_height), (second_x, second_height)


def prepare_simulations(board: Sequence[Sequence[int]], colors: Sequence[int]) -> List[Placement]:
    """현재 뿌요 쌍의 모든 착지 후보를 계산한다. puyow.js의 prepareAiPlacementSimulations에 대응한다."""
    simulations: List[Placement] = []
    for rotation in range(ROTATION_COUNT):
        for x in range(BOARD_WIDTH):
            landing = find_landing_placement(board, x, rotation)
            if landing is None:
                continue
            positions = [landing[0], landing[1]]
            attack = estimate_attack(board, colors, positions)
            combo = estimate_combo(board, colors, positions)
            simulations.append(Placement(x, rotation, positions, attack, combo))
    return simulations


def find_best_attack_placement(board, colors, simulations: Sequence[Placement], fallback_x: int,
                                defeat_check_column: Optional[int] = None,
                                exclude_all_immediate_defeats: bool = False) -> Placement:
    """예상 ATTACK이 가장 큰 배치를 고른다(동점이면 더 오른쪽 열). puyow.js의 findBestAttackPlacement에 대응한다."""
    best = Placement(fallback_x, ROTATION_UP, [], -1.0, 0)
    for sim in simulations:
        if exclude_all_immediate_defeats and causes_immediate_defeat(board, colors, sim.positions):
            continue
        if any(y == 2 for _x, y in sim.positions) and causes_immediate_defeat(board, colors, sim.positions):
            continue
        if sim.x == defeat_check_column and causes_immediate_defeat(board, colors, sim.positions):
            continue
        if sim.attack > best.attack or (sim.attack == best.attack and sim.x >= best.x):
            best = sim
    if not best.positions and simulations:
        # puyow.js의 실제 게임 루프는 여기서 나온 x·rotation으로 실물 뿌요를 이동시켜 중력으로
        # 착지시키므로, 후보가 모두 배제되어도(=어느 수를 둬도 곧 패배) 유효한 착지가 나온다.
        # 이 포팅은 실시간 이동 루프가 없으므로, 같은 x·rotation의 실제 착지를 다시 계산해
        # 반환값이 항상 실행 가능한 배치가 되도록 한다.
        landing = find_landing_placement(board, best.x, best.rotation)
        if landing is not None:
            positions = [landing[0], landing[1]]
            best = Placement(best.x, best.rotation, positions, estimate_attack(board, colors, positions), estimate_combo(board, colors, positions))
        else:
            best = max(simulations, key=lambda s: (s.attack, s.x))
    return best


def get_ai_defeat_position_avoidance_columns(board: Sequence[Sequence[int]], force: bool = False) -> List[int]:
    """패배 위치 경고로 피해야 할 열 목록을 구한다. puyow.js의 getAiDefeatPositionAvoidanceColumns에 대응한다(기본 룰만 다루므로 항상 X=2 하나뿐이다)."""
    if force or board[AVOIDANCE_WARNING_ROW][DEFEAT_COLUMN] != EMPTY:
        return [DEFEAT_COLUMN]
    return []


def _is_defeat_position_restricted(sim: Placement, avoidance_columns: Sequence[int]) -> bool:
    """패배 위치 경고 중에 폭발 없이 위험 열에 놓는 후보인지 확인한다. puyow.js의 isAiDefeatPositionPlacementRestricted에 대응한다."""
    if not avoidance_columns:
        return False
    return sim.combo == 0 and any(x in avoidance_columns for x, _y in sim.positions)


def find_ai_defeat_position_safe_placement(board, colors, simulations: Sequence[Placement], force: bool = False) -> Optional[Placement]:
    """패배 위치 경고 규칙을 만족하는 후보 중 ATTACK이 가장 큰 배치를 고른다. puyow.js의 findAiDefeatPositionSafePlacement에 대응한다."""
    avoidance = get_ai_defeat_position_avoidance_columns(board, force)
    candidates = [s for s in simulations if not _is_defeat_position_restricted(s, avoidance)]
    if not candidates:
        return None
    immediately_safe = [s for s in candidates if not causes_immediate_defeat(board, colors, s.positions)]
    pool = immediately_safe if immediately_safe else candidates
    best = None
    for sim in pool:
        if best is None or sim.attack > best.attack or (sim.attack == best.attack and sim.x > best.x):
            best = sim
    return best


def select_random_empty_field_placement(board, colors, simulations: Sequence[Placement], rng: random.Random) -> Optional[Placement]:
    """빈 필드에서 첫 배치를 무작위로 고른다(즉시 패배하지 않는 후보 우선). puyow.js의 selectRandomEmptyFieldPlacement에 대응한다."""
    if not is_board_empty(board) or not simulations:
        return None
    safe = [s for s in simulations if not causes_immediate_defeat(board, colors, s.positions)]
    candidates = safe if safe else simulations
    if not candidates:
        return None
    return rng.choice(candidates)


def find_best_preview_result(board, colors) -> Tuple[int, float]:
    """가상 보드에서 예고 뿌요 쌍으로 만들 수 있는 최고 연쇄·ATTACK을 계산한다."""
    best_combo, best_attack = 0, 0.0
    for rotation in range(ROTATION_COUNT):
        for x in range(BOARD_WIDTH):
            landing = find_landing_placement(board, x, rotation)
            if landing is None:
                continue
            positions = [landing[0], landing[1]]
            combo = estimate_combo(board, colors, positions)
            attack = estimate_attack(board, colors, positions)
            if combo > best_combo or (combo == best_combo and attack > best_attack):
                best_combo, best_attack = combo, attack
    return best_combo, best_attack


def _compute_previews(board, colors, simulations: Sequence[Placement], next_pairs: Sequence[Sequence[int]]) -> None:
    """데카라비아·벨리알(및 상속받는 암두시아스)이 공유하는 예고쌍 미리보기 계산이다."""
    for sim in simulations:
        result_board = simulate_placement_board(board, colors, sim.positions)
        sim.all_clear = is_all_clear_board(result_board) if result_board is not None else False
        preview_combo, preview_attack = 0, 0.0
        if result_board is not None:
            for pair in list(next_pairs)[:2]:
                combo, attack = find_best_preview_result(result_board, pair)
                if combo > preview_combo or (combo == preview_combo and attack > preview_attack):
                    preview_combo, preview_attack = combo, attack
        sim.preview_combo = preview_combo
        sim.preview_attack = preview_attack


# ---------------------------------------------------------------------------
# N수 읽기 (키마리스의 2수 탐색, 안드레알푸스의 3수 탐색이 공유한다)
# ---------------------------------------------------------------------------

def get_n_move_board_score(board: Sequence[Sequence[int]]) -> float:
    """N수 읽기에서 연쇄 기반을 비교할 보드 점수를 계산한다. puyow.js의 getNMoveBoardScore에 대응한다."""
    score = 0.0
    for y in range(BOARD_HEIGHT):
        for x in range(BOARD_WIDTH):
            color = board[y][x]
            if color < 0:
                continue
            score -= y * 4
            if x < BOARD_WIDTH - 1 and board[y][x + 1] == color:
                score += 80
            if y < BOARD_HEIGHT - 1 and board[y + 1][x] == color:
                score += 55
            if y >= AVOIDANCE_WARNING_ROW and x == DEFEAT_COLUMN:
                score -= 180
    return score


def get_n_move_placement_score(combo: int, attack: float, all_clear: bool, target_combo: int, board) -> float:
    """한 수의 연쇄·싱글 보드 결과를 목표 연쇄 중심으로 점수화한다. puyow.js의 getNMovePlacementScore에 대응한다."""
    board_score = get_n_move_board_score(board)
    if all_clear:
        return 2_000_000 + combo * 10000 + attack * 1000 + board_score
    if combo >= target_combo:
        return 1_000_000 + combo * 10000 + attack * 1000 + board_score
    premature_penalty = (target_combo - combo + 1) * 25000 if combo > 0 else 0
    return attack * 200 + board_score - premature_penalty


def find_best_n_move_board_result(board, colors: Optional[Sequence[int]], next_pairs: Sequence[Sequence[int]],
                                   next_pair_index: int, remaining_turns: int, target_combo: int) -> Optional[NMovePlan]:
    """가상 보드에서 한 수를 놓은 뒤 남은 수만큼 최선의 경로를 재귀적으로 찾는다. puyow.js의 findBestNMoveBoardResult에 대응한다."""
    if colors is None or len(colors) != 2:
        return None
    best: Optional[NMovePlan] = None
    for rotation in range(ROTATION_COUNT):
        for x in range(BOARD_WIDTH):
            landing = find_landing_placement(board, x, rotation)
            if landing is None:
                continue
            positions = [landing[0], landing[1]]
            result_board, combo, attack = _place_and_resolve(board, colors, positions)
            if result_board is None or is_defeat_board(result_board):
                continue
            all_clear = is_all_clear_board(result_board)
            future = None
            if remaining_turns > 1:
                next_colors = next_pairs[next_pair_index] if next_pair_index < len(next_pairs) else None
                future = find_best_n_move_board_result(result_board, next_colors, next_pairs, next_pair_index + 1, remaining_turns - 1, target_combo)
            score = get_n_move_placement_score(combo, attack, all_clear, target_combo, result_board)
            if future is not None:
                score += future.score * 0.92
            candidate = NMovePlan(
                x, rotation, positions, result_board, combo, attack, all_clear,
                max(combo, future.max_combo if future else 0),
                attack + (future.total_attack if future else 0),
                score, future,
            )
            if (best is None or candidate.score > best.score
                    or (candidate.score == best.score and candidate.max_combo > best.max_combo)
                    or (candidate.score == best.score and candidate.max_combo == best.max_combo and candidate.x > best.x)):
                best = candidate
    return best


def simulate_n_move_placements(board, colors, next_pairs: Sequence[Sequence[int]], target_combo: int = 6, turn_count: int = 2) -> List[NMovePlan]:
    """현재 수와 예고쌍을 N수까지 가상 배치해 이번 수 후보별 평가 결과를 만든다. puyow.js의 simulateNMovePlacements에 대응한다."""
    if colors is None:
        return []
    target = max(1, int(target_combo))
    turns = max(1, min(int(turn_count), len(next_pairs) + 1))
    simulations = prepare_simulations(board, colors)
    results: List[NMovePlan] = []
    for sim in simulations:
        if causes_immediate_defeat(board, colors, sim.positions):
            continue
        result_board, combo, attack = _place_and_resolve(board, colors, sim.positions)
        if result_board is None or is_defeat_board(result_board):
            continue
        all_clear = is_all_clear_board(result_board)
        future = None
        if turns > 1:
            next_colors = next_pairs[0] if len(next_pairs) > 0 else None
            future = find_best_n_move_board_result(result_board, next_colors, next_pairs, 1, turns - 1, target)
        score = get_n_move_placement_score(combo, attack, all_clear, target, result_board)
        if future is not None:
            score += future.score * 0.92
        results.append(NMovePlan(
            sim.x, sim.rotation, sim.positions, result_board, combo, attack, all_clear,
            max(combo, future.max_combo if future else 0),
            attack + (future.total_attack if future else 0),
            score, future, simulation=sim,
        ))
    return results


def find_best_n_move_placement(board, colors, next_pairs, target_combo: int = 6, turn_count: int = 2) -> Optional[NMovePlan]:
    """N수 시뮬레이션 결과 가운데 목표 연쇄·싱글 보드 기준 최선의 이번 수 후보를 고른다. puyow.js의 findBestNMovePlacement에 대응한다."""
    best: Optional[NMovePlan] = None
    for candidate in simulate_n_move_placements(board, colors, next_pairs, target_combo, turn_count):
        if (best is None or candidate.score > best.score
                or (candidate.score == best.score and candidate.max_combo > best.max_combo)
                or (candidate.score == best.score and candidate.max_combo == best.max_combo and candidate.x > best.x)):
            best = candidate
    return best


# ---------------------------------------------------------------------------
# 적 클래스 계층 (puyow.js의 Enemy/BundledEnemy 계열에 대응)
# ---------------------------------------------------------------------------

class BaseEnemy:
    """puyow.js Enemy의 파이썬 대응. 인스턴스 상태로 여러 턴에 걸친 판단을 유지한다."""

    # puyow.js RANDOM_EMPTY_FIELD_ENEMY_TYPES에 포함된 적만 True로 재정의한다.
    uses_random_empty_field = False

    def __init__(self, rng: Optional[random.Random] = None):
        """이 적 전용 난수 생성기를 받는다(무작위 초기 배치 등에 사용). 생략하면 새로 만든다."""
        self.rng = rng or random.Random()

    def get_class_type(self) -> str:
        """진행 상황 저장·비교에 쓰는 클래스 이름이다. 하위 클래스는 반드시 재정의해야 한다."""
        return 'Enemy'

    def decide(self, board, colors, next_pairs, incoming_garbage: float = 0.0) -> Optional[Placement]:
        """이번 수의 배치를 결정한다. 착지 가능한 후보가 하나도 없으면 None(필드가 가득 참)을 반환한다."""
        simulations = prepare_simulations(board, colors)
        if not simulations:
            return None
        prepared = self._prepare_common(board, colors, simulations)
        if prepared is not None:
            return self._finalize(board, colors, simulations, prepared)
        chosen = self._choose(board, colors, simulations, next_pairs, incoming_garbage)
        return self._finalize(board, colors, simulations, chosen)

    def _prepare_common(self, board, colors, simulations: List[Placement]) -> Optional[Placement]:
        """모든 적이 공유하는 우선 판단(빈 필드 무작위 배치, 패배 위치 회피)이다. puyow.js Enemy.prepareTurn의 공통 부분에 대응한다."""
        if self.uses_random_empty_field:
            placement = select_random_empty_field_placement(board, colors, simulations, self.rng)
            if placement is not None:
                return placement
        if get_ai_defeat_position_avoidance_columns(board):
            return find_ai_defeat_position_safe_placement(board, colors, simulations)
        return None

    def _choose(self, board, colors, simulations: List[Placement], next_pairs, incoming_garbage: float) -> Placement:
        """공통 우선 판단이 없을 때 쓸 적별 전략이다. 하위 클래스가 재정의하며, 기본값은 puyow.js Enemy.chooseTarget처럼 회전 없이 가장 오른쪽 열이다."""
        fallback = next((s for s in simulations if s.x == BOARD_WIDTH - 1 and s.rotation == ROTATION_UP), None)
        return fallback or simulations[0]

    def _finalize(self, board, colors, simulations: List[Placement], chosen: Placement) -> Placement:
        """puyow.js의 selectSafeRotation에 대응한다. 선택한 배치가 즉시 패배하면 안전한 공격 후보로 바꾼다."""
        if causes_immediate_defeat(board, colors, chosen.positions):
            return find_best_attack_placement(board, colors, simulations, chosen.x, exclude_all_immediate_defeats=True)
        return chosen


class BundledEnemy(BaseEnemy):
    """기본 제공 적임을 나타내는 표시용 클래스다. puyow.js의 BundledEnemy에 대응한다."""

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'BundledEnemy'


class Dantalion(BundledEnemy):
    """양쪽 하단을 번갈아 채운 뒤 공격 시뮬레이션으로 전환한다."""

    def __init__(self, rng: Optional[random.Random] = None):
        """왼쪽부터 채우는 초기 단계(initialLeft)와 첫 전환까지 남은 턴 수로 시작한다."""
        super().__init__(rng)
        self.phase = 'initialLeft'
        self.turns_remaining = self._random_turns()

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Dantalion'

    def _random_turns(self) -> int:
        """한 단계(왼쪽/오른쪽 쌓기)를 유지할 턴 수를 6~8 사이에서 무작위로 정한다."""
        return 6 + int(self.rng.random() * 3)

    @staticmethod
    def _is_side_filled(board, side: int) -> bool:
        """목표 측 열의 하단 두 칸이 모두 찼는지 확인한다."""
        return board[0][side] != EMPTY and board[1][side] != EMPTY

    @staticmethod
    def _select_side_build_placement(board, colors, simulations: List[Placement], side: int) -> Optional[Placement]:
        """목표 측 하단을 채우되 즉시 패배하지 않는 배치 중, 목표 열에 가깝고 낮은 자리를 우선해 고른다."""
        selected, best_score = None, float('-inf')
        for sim in simulations:
            if sim.combo != 0 or causes_immediate_defeat(board, colors, sim.positions):
                continue
            score = 0.0
            for x, y in sim.positions:
                score += (1000 if y <= 1 else 0) - abs(x - side) * 50 - y
            if score >= best_score:
                selected, best_score = sim, score
        return selected

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """트리거 칸이 찼거나 방해뿌요가 많이 쌓이면 공격 시뮬레이션으로 전환하고, 그 전까지는 좌→우 순서로 하단을 채운다."""
        trigger_occupied = board[ATTACK_TRIGGER_Y][ATTACK_TRIGGER_X] != EMPTY
        if trigger_occupied or self.phase == 'simulation' or incoming_garbage >= AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD:
            chosen = find_best_attack_placement(board, colors, simulations, 0, ATTACK_TRIGGER_X if trigger_occupied else None, True)
            self.phase = 'repeatLeft'
            if not trigger_occupied:
                self.turns_remaining = 6
            return chosen

        target = BOARD_WIDTH - 1 if self.phase == 'initialRight' else 0
        build = self._select_side_build_placement(board, colors, simulations, target)
        safe_fallback = next((s for s in simulations if not causes_immediate_defeat(board, colors, s.positions)), None)
        basic = build or safe_fallback
        if not self._is_side_filled(board, target) and basic:
            return basic

        self.turns_remaining -= 1
        if self.turns_remaining <= 0:
            if self.phase == 'initialLeft':
                self.phase = 'initialRight'
                self.turns_remaining = self._random_turns()
            else:
                self.phase = 'simulation'
        return basic or simulations[0]


class ChainBuildingEnemy(BundledEnemy):
    """연쇄 축적형 적들이 공유하는 필드 평가와 안전 배치 전략이다. 단독으로 등록되는 적은 아니다."""

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'ChainBuildingEnemy'

    @staticmethod
    def get_field_occupancy(board) -> float:
        """화면에 보이는 영역의 뿌요 점유율(0~1)을 구한다. puyow.js의 getFieldOccupancy에 대응한다."""
        occupied = sum(1 for row in board for cell in row if cell != EMPTY)
        return occupied / (BOARD_WIDTH * VISIBLE_ROWS)

    @staticmethod
    def get_safe_simulations(board, colors, simulations: List[Placement]) -> List[Placement]:
        """즉시 패배하는 후보를 제외한 배치 목록을 만든다. puyow.js의 getSafeSimulations에 대응한다."""
        safe = []
        for sim in simulations:
            placed_at_third_row = any(y == 2 for _x, y in sim.positions)
            loses = causes_immediate_defeat(board, colors, sim.positions)
            if loses:
                continue
            safe.append(sim)
            del placed_at_third_row  # puyow.js와 동일하게, y=2 배치도 결국 losesImmediately 조건으로 걸러진다.
        return safe

    @staticmethod
    def select_simulation(simulations: Sequence[Placement], predicate: Callable[[Placement], bool],
                           score_fn: Callable[[Placement], float]) -> Optional[Placement]:
        """조건(predicate)을 통과한 후보 중 점수(score_fn)가 가장 높은 것을 고른다. puyow.js의 selectSimulation에 대응한다."""
        selected, best_score = None, float('-inf')
        for sim in simulations:
            if not predicate(sim):
                continue
            current = score_fn(sim)
            if current >= best_score:
                selected, best_score = sim, current
        return selected

    @staticmethod
    def get_build_score(board, colors, sim: Placement) -> float:
        """터뜨리지 않고 연쇄 재료를 모으는 후보의 기반 점수를 계산한다(같은 색 인접·낮고 중앙에 가까움을 우대). puyow.js의 getBuildScore에 대응한다."""
        score = 0.0
        for index, (x, y) in enumerate(sim.positions):
            color = colors[index]
            for dx, dy in DIRECTIONS:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < BOARD_WIDTH and 0 <= ny < BOARD_HEIGHT):
                    continue
                cell = board[ny][nx]
                if cell == color:
                    score += 12
                elif cell != EMPTY:
                    score += 1
            score += max(0, 8 - y) * 0.45
            score -= abs(x - (BOARD_WIDTH - 1) / 2) * 0.2
        return score

    def select_build_simulation(self, board, colors, simulations: List[Placement]) -> Optional[Placement]:
        """아직 터뜨리지 않는 후보 중 기반 점수가 가장 높은 배치를 고른다. puyow.js의 selectBuildSimulation에 대응한다."""
        return self.select_simulation(simulations, lambda s: s.combo == 0, lambda s: self.get_build_score(board, colors, s))


def _select_build_with_preview(enemy: ChainBuildingEnemy, board, colors, simulations: List[Placement]) -> Optional[Placement]:
    """데카라비아·벨리알이 공유하는, 예고쌍으로 이어질 연쇄 가능성까지 더한 쌓기 후보 선택이다. 각 클래스의 selectBuildSimulation 재정의에 대응한다."""
    return enemy.select_simulation(
        simulations, lambda s: s.combo == 0,
        lambda s: enemy.get_build_score(board, colors, s) + (s.preview_combo or 0) * 1000 + (s.preview_attack or 0),
    )


def _choose_with_preview(enemy: ChainBuildingEnemy, board, colors, simulations: List[Placement], incoming_garbage: float) -> Placement:
    """데카라비아·벨리알이 공유하는, 예고쌍 미리보기를 반영한 공격/쌓기 선택 로직이다."""
    safe = enemy.get_safe_simulations(board, colors, simulations)
    pool = safe if safe else simulations
    occupancy = enemy.get_field_occupancy(board)

    def score(s: Placement) -> float:
        """싹쓸이 후보 비교용 점수: 이번 수 ATTACK + 예고쌍 최고 ATTACK."""
        return s.attack + (s.preview_attack or 0)

    def score_with_combo(s: Placement) -> float:
        """일반 후보 비교용 점수: 이번 수 ATTACK + 예고쌍 최고 연쇄 수."""
        return s.attack + (s.preview_combo or 0)

    selected = enemy.select_simulation(pool, lambda s: s.all_clear is True, score)
    if not selected and incoming_garbage >= 12:
        selected = enemy.select_simulation(pool, lambda s: True, score_with_combo)
    elif not selected and occupancy >= 0.8:
        selected = enemy.select_simulation(pool, lambda s: s.combo >= 1, score_with_combo)
    elif not selected and occupancy >= 0.5:
        selected = enemy.select_simulation(pool, lambda s: s.combo == 2, score_with_combo)
        if not selected:
            selected = enemy.select_simulation(pool, lambda s: s.combo >= 2, lambda s: score_with_combo(s) - abs(s.combo - 2) * 10000)
    elif not selected:
        selected = enemy.select_simulation(pool, lambda s: s.combo >= 4, score_with_combo)
        if not selected:
            selected = enemy.select_build_simulation(board, colors, pool)

    fallback_x = simulations[0].x if simulations else 2
    return selected or find_best_attack_placement(board, colors, simulations, fallback_x)


class Decarabia(ChainBuildingEnemy):
    """세레의 연쇄 축적 전략을 이어받되, 예고쌍 미리보기와 싹쓸이 우선 판단을 더한다."""

    uses_random_empty_field = True

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Decarabia'

    def select_build_simulation(self, board, colors, simulations):
        """예고쌍 전망을 더해 쌓기 후보를 고른다."""
        return _select_build_with_preview(self, board, colors, simulations)

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """예고쌍 전망을 계산한 뒤 싹쓸이·필드 점유율에 맞춰 공격 또는 쌓기 배치를 고른다."""
        _compute_previews(board, colors, simulations, next_pairs)
        return _choose_with_preview(self, board, colors, simulations, incoming_garbage)


class Belial(ChainBuildingEnemy):
    """벨리알은 데카라비아가 사용하던 예고쌍 평가 및 싹쓸이 우선 전략을 그대로 사용한다."""

    uses_random_empty_field = True

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Belial'

    def select_build_simulation(self, board, colors, simulations):
        """예고쌍 전망을 더해 쌓기 후보를 고른다."""
        return _select_build_with_preview(self, board, colors, simulations)

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """예고쌍 전망을 계산한 뒤 싹쓸이·필드 점유율에 맞춰 공격 또는 쌓기 배치를 고른다."""
        _compute_previews(board, colors, simulations, next_pairs)
        return _choose_with_preview(self, board, colors, simulations, incoming_garbage)


class Amdusias(Belial):
    """벨리알의 예고쌍·싹쓸이 평가를 이어받되, 평상시 목표를 5연쇄로 한 단계 높인다."""

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Amdusias'

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """예고쌍 전망을 계산한 뒤, 필드 점유율에 맞춰 5연쇄를 목표로 공격 또는 쌓기 배치를 고른다."""
        _compute_previews(board, colors, simulations, next_pairs)
        safe = self.get_safe_simulations(board, colors, simulations)
        pool = safe if safe else simulations
        occupancy = self.get_field_occupancy(board)

        def score(s: Placement) -> float:
            """후보 비교용 점수: 이번 수 ATTACK + 예고쌍 최고 ATTACK + 예고쌍 최고 연쇄 가중치."""
            return s.attack + (s.preview_attack or 0) + (s.preview_combo or 0) * 1000

        selected = self.select_simulation(pool, lambda s: s.all_clear is True, score)
        # 원작의 "피버 룰이고 DAMAGE가 있으면 즉시 공격" 분기는 기본 룰만 다루는 이 포팅에서는 적용되지 않는다.
        if not selected and occupancy >= 0.8:
            selected = self.select_simulation(pool, lambda s: s.combo >= 1, score)
        elif not selected and occupancy >= 0.5:
            selected = self.select_simulation(pool, lambda s: s.combo == 2, score)
            if not selected:
                selected = self.select_simulation(pool, lambda s: s.combo >= 2, lambda s: score(s) - abs(s.combo - 2) * 10000)
        elif not selected:
            selected = self.select_simulation(pool, lambda s: s.combo >= 5, score)
            if not selected:
                selected = self.select_build_simulation(board, colors, pool)

        fallback_x = simulations[0].x if simulations else 2
        return selected or find_best_attack_placement(board, colors, simulations, fallback_x, None, True)


class Kimaris(Amdusias):
    """현재 뿌요와 다음 예고쌍을 함께 읽어(2수) 연쇄 기반·공격·생존을 비교한다."""

    def __init__(self, rng: Optional[random.Random] = None):
        """긴급 상쇄 기준(4개 미만은 무시), 목표 연쇄(6), 탐색 수(2수)를 기본값으로 정한다."""
        super().__init__(rng)
        self.ignorable_incoming_garbage = 4
        self.target_combo = 6
        self.lookahead_turn_count = 2

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Kimaris'

    def _find_best_lookahead_placement(self, board, colors, next_pairs, incoming_garbage) -> Optional[Placement]:
        """2수 탐색 결과 중 생존(방해뿌요 상쇄)·점수·최대 연쇄 순으로 가장 좋은 이번 수 후보를 고른다."""
        plans = simulate_n_move_placements(board, colors, next_pairs, self.target_combo, self.lookahead_turn_count)
        incoming = max(0.0, math.floor(incoming_garbage))
        urgent = incoming >= self.ignorable_incoming_garbage
        best: Optional[NMovePlan] = None
        for plan in plans:
            available_attack = math.floor(plan.attack)
            plan.remaining_incoming = max(0.0, incoming - available_attack)
            plan.unresolved_danger = incoming >= self.ignorable_incoming_garbage and plan.remaining_incoming >= self.ignorable_incoming_garbage
            if best is None:
                best = plan
                continue
            if urgent and plan.unresolved_danger != best.unresolved_danger:
                if not plan.unresolved_danger:
                    best = plan
                continue
            if urgent and plan.unresolved_danger and plan.remaining_incoming != best.remaining_incoming:
                if plan.remaining_incoming < best.remaining_incoming:
                    best = plan
                continue
            if plan.score != best.score:
                if plan.score > best.score:
                    best = plan
                continue
            if plan.max_combo != best.max_combo:
                if plan.max_combo > best.max_combo:
                    best = plan
                continue
            if plan.x > best.x:
                best = plan
        return best.simulation if best else None

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """2수 탐색으로 열을 정하되, 회전은 탐색 결과를 무시하고 항상 세로로 놓는다(아래 주석·모듈 docstring 참고)."""
        plan_sim = self._find_best_lookahead_placement(board, colors, next_pairs, incoming_garbage)
        if plan_sim is None:
            fallback_x = simulations[0].x if simulations else 2
            return find_best_attack_placement(board, colors, simulations, fallback_x, None, True)
        # 원작 puyow.js의 Kimaris는 chooseRotate()를 재정의하지 않아 탐색이 고른 회전을 무시하고
        # 항상 세로(회전 0)로 놓는다. 모듈 docstring 참고. 이 포팅은 그 동작을 그대로 재현한다.
        vertical = next((s for s in simulations if s.x == plan_sim.x and s.rotation == ROTATION_UP), None)
        return vertical or plan_sim


class Andrealphus(BundledEnemy):
    """키마리스와 같은 생존·상쇄 평가를 쓰되, 평상시 최대 3수 앞까지 읽는다.

    원작은 Blob Worker에서 1수→2수→3수 순으로 반복 심화 탐색하며, 매 깊이가 끝날 때마다
    현재 1수의 선택을 갱신하고 `lookaheadTimeLimitMs`(기본 50ms)를 넘기면 그때까지 완료된
    가장 깊은 결과를 사용한다. 이 포팅은 별도 스레드 없이 같은 순서로 동기 반복 심화를
    수행해 같은 시간 제한 안에서 비슷한 깊이로 수렴하도록 한다.
    """

    uses_random_empty_field = True

    def __init__(self, rng: Optional[random.Random] = None):
        """긴급 상쇄 기준(4개 미만은 무시), 목표 연쇄(7), 최대 탐색 수(3수), 시간 제한(50ms)을 기본값으로 정한다."""
        super().__init__(rng)
        self.ignorable_incoming_garbage = 4
        self.target_combo = 7
        self.lookahead_turn_count = 3
        # Worker 반복 심화 탐색의 최대 대기 시간(ms)이다. 호출자가 인스턴스별로 조정할 수 있다.
        self.lookahead_time_limit_ms = 50.0

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Andrealphus'

    @staticmethod
    def _is_field_at_least_eighty_percent_filled(board) -> bool:
        """화면에 보이는 영역의 80% 이상이 찼는지 확인한다."""
        occupied = sum(1 for row in board for cell in row if cell != EMPTY)
        return occupied >= BOARD_WIDTH * VISIBLE_ROWS * 0.8

    def _prepare_common(self, board, colors, simulations):
        """공통 판단에 더해, 필드가 80% 이상 찼으면 피버 중이 아닐 때 패배 위치 회피를 강제한다."""
        prepared = super()._prepare_common(board, colors, simulations)
        if prepared is not None:
            return prepared
        if self._is_field_at_least_eighty_percent_filled(board):
            forced = find_ai_defeat_position_safe_placement(board, colors, simulations, force=True)
            if forced is not None:
                return forced
        return None

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """1수→2수→3수 순으로 반복 심화 탐색하되, 다음 깊이가 시간 제한을 넘길 것 같으면 지금까지의 가장 깊은 결과를 쓴다."""
        deadline = time.monotonic() + max(0.0, self.lookahead_time_limit_ms) / 1000.0
        best = None
        # 탐색 트리 안에서 시간을 확인할 수는 없으므로(재귀 함수가 puyow.js와 동일한 형태를
        # 유지하도록 그대로 뒀다), 한 깊이가 끝날 때마다 다음 깊이의 예상 소요 시간을 분기
        # 수(열 6 * 회전 4 = 24)만큼 커진다고 추정해, 남은 시간 안에 끝나지 않을 것 같으면
        # 다음 깊이를 아예 시작하지 않는다.
        branching_factor = BOARD_WIDTH * ROTATION_COUNT
        last_depth_duration = None
        for depth in range(1, self.lookahead_turn_count + 1):
            if last_depth_duration is not None:
                projected = last_depth_duration * branching_factor
                if time.monotonic() + projected > deadline:
                    break
            started_at = time.monotonic()
            candidate = find_best_n_move_placement(board, colors, next_pairs, self.target_combo, depth)
            last_depth_duration = max(time.monotonic() - started_at, 1e-4)
            if candidate is not None:
                best = candidate
            if time.monotonic() >= deadline:
                break
        if best is None:
            fallback_x = simulations[0].x if simulations else 2
            return find_best_attack_placement(board, colors, simulations, fallback_x, None, True)
        return best.simulation


class Seere(BundledEnemy):
    """오른쪽 두 열 → X=3의 화면 절반 → 왼쪽 열 순서로 쌓은 뒤, 20~25턴마다 공격 시뮬레이션을 수행한다."""

    def __init__(self, rng: Optional[random.Random] = None):
        """다음 공격 시뮬레이션까지 남은 턴 수(20~25)를 정하며 시작한다."""
        super().__init__(rng)
        self.turn_count = 0
        self.turns_until_simulation = self._random_turns_until_simulation()

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Seere'

    def _random_turns_until_simulation(self) -> int:
        """다음 공격 시뮬레이션까지의 일반 배치 턴 수를 20~25 사이에서 무작위로 정한다."""
        return 20 + int(self.rng.random() * 6)

    @staticmethod
    def _is_right_three_rows_filled(board) -> bool:
        """가장 오른쪽 열의 아래 세 칸이 모두 찼는지 확인한다."""
        return all(board[y][BOARD_WIDTH - 1] != EMPTY for y in (0, 1, 2))

    @staticmethod
    def _is_column_filled_to_height(board, x: int, height: int) -> bool:
        """열 x의 아래부터 height칸이 모두 찼는지 확인한다."""
        return all(board[y][x] != EMPTY for y in range(height))

    @staticmethod
    def _select_right_two_build(board, colors, simulations):
        """오른쪽 두 열을 화면 높이까지 채우는 비폭발 배치 중, 낮은 열 위주로 고른다."""
        selected, best_score = None, float('-inf')
        for sim in simulations:
            if sim.combo != 0 or causes_immediate_defeat(board, colors, sim.positions):
                continue
            if not all(x >= BOARD_WIDTH - 2 and y < VISIBLE_ROWS for x, y in sim.positions):
                continue
            score = 0.0
            for x, y in sim.positions:
                filled_height = sum(1 for row in board if row[x] != EMPTY)
                score += 1000 - filled_height * 10 - y
            if score >= best_score:
                selected, best_score = sim, score
        return selected

    @staticmethod
    def _select_third_column_build(board, colors, simulations):
        """오른쪽에서 세 번째 열(X=3)을 화면 절반 높이까지만 채우는 비폭발 배치를 고른다."""
        selected, best_score = None, float('-inf')
        target_column = BOARD_WIDTH - 3
        target_height = math.ceil(VISIBLE_ROWS / 2)
        for sim in simulations:
            if sim.combo != 0 or causes_immediate_defeat(board, colors, sim.positions):
                continue
            if not all(x == target_column and y < target_height for x, y in sim.positions):
                continue
            score = sum(1000 - y for _x, y in sim.positions)
            if score >= best_score:
                selected, best_score = sim, score
        return selected

    def _select_left_build(self, board, colors, simulations):
        """왼쪽 두 열을 가장 왼쪽 열부터 차례로 채우는 비폭발 배치를 고른다."""
        target_column = 1 if self._is_column_filled_to_height(board, 0, VISIBLE_ROWS) else 0
        selected, best_score = None, float('-inf')
        for sim in simulations:
            if sim.combo != 0 or causes_immediate_defeat(board, colors, sim.positions):
                continue
            if not all(x == target_column and y < VISIBLE_ROWS for x, y in sim.positions):
                continue
            score = sum(1000 - y for _x, y in sim.positions)
            if score >= best_score:
                selected, best_score = sim, score
        return selected

    def _select_standard_build(self, board, colors, simulations):
        """오른쪽 두 열 → X=3의 화면 절반 → 왼쪽 열 순서로 다음 쌓기 단계를 골라 배치를 정한다."""
        right_filled = (self._is_column_filled_to_height(board, BOARD_WIDTH - 2, VISIBLE_ROWS)
                        and self._is_column_filled_to_height(board, BOARD_WIDTH - 1, VISIBLE_ROWS))
        if not right_filled:
            return self._select_right_two_build(board, colors, simulations)
        if not self._is_column_filled_to_height(board, BOARD_WIDTH - 3, math.ceil(VISIBLE_ROWS / 2)):
            return self._select_third_column_build(board, colors, simulations)
        return self._select_left_build(board, colors, simulations)

    def _choose(self, board, colors, simulations, next_pairs, incoming_garbage):
        """트리거 칸이 찼거나 방해뿌요가 많으면 즉시 공격하고, 그 밖에는 표준 순서로 쌓다가 주기적으로 공격 시뮬레이션을 수행한다."""
        trigger_occupied = board[ATTACK_TRIGGER_Y][ATTACK_TRIGGER_X] != EMPTY
        if trigger_occupied or incoming_garbage >= AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD:
            return find_best_attack_placement(board, colors, simulations, 0, ATTACK_TRIGGER_X if trigger_occupied else None, True)

        build = self._select_standard_build(board, colors, simulations)
        safe_fallback = next((s for s in simulations if not causes_immediate_defeat(board, colors, s.positions)), None)
        basic = build or safe_fallback

        self.turn_count += 1
        if self.turn_count > self.turns_until_simulation:
            chosen = find_best_attack_placement(board, colors, simulations, BOARD_WIDTH - 1, None, True)
            self.turn_count = 0
            self.turns_until_simulation = self._random_turns_until_simulation()
            return chosen

        if not self._is_right_three_rows_filled(board) and basic:
            return basic
        return basic or simulations[0]


class Flauros(BundledEnemy):
    """출시 예정(notAvail) 상태의 원작과 같이, 이동·회전 판단 없이 스폰 위치에 세로로 떨어뜨리기만 한다."""

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'Flauros'

    def decide(self, board, colors, next_pairs, incoming_garbage: float = 0.0) -> Optional[Placement]:
        """이동·회전 판단 없이 스폰 열(X=2)에 세로로 자연 낙하시킨다. 그 열이 막히면 기본 결정 로직으로 대체한다."""
        landing = find_landing_placement(board, SPAWN_X, ROTATION_UP)
        if landing is None:
            return super().decide(board, colors, next_pairs, incoming_garbage)
        positions = [landing[0], landing[1]]
        return Placement(SPAWN_X, ROTATION_UP, positions, estimate_attack(board, colors, positions), estimate_combo(board, colors, positions))


class PracticeEnemy(BundledEnemy):
    """연습 모드 전용 상대다. 뿌요를 받지 않는 쪽은 학습 환경에서 별도로 처리하므로 여기서는 등록만 한다."""

    def get_class_type(self) -> str:
        """진행 상황 저장에 쓰는 클래스 이름이다."""
        return 'PracticeEnemy'


# 학습에서 대전 상대로 고를 수 있는 적 목록이다. puyow.js OPPONENTS 등록 순서에서
# 솔로몬·안드로말리우스(사용자 요청으로 제외)와 연습 상대(PracticeEnemy, 비경쟁 상대)를 뺐다.
ENEMY_FACTORIES = {
    'Dantalion': Dantalion,
    'Seere': Seere,
    'Decarabia': Decarabia,
    'Belial': Belial,
    'Amdusias': Amdusias,
    'Kimaris': Kimaris,
    'Andrealphus': Andrealphus,
    'Flauros': Flauros,
}

TRAINABLE_ENEMY_TYPES: Tuple[str, ...] = tuple(ENEMY_FACTORIES.keys())


def create_enemy(class_type: str, rng: Optional[random.Random] = None) -> BaseEnemy:
    """클래스 이름 문자열로 해당 적 인스턴스를 새로 만든다. TRAINABLE_ENEMY_TYPES에 없는 이름이면 오류를 낸다."""
    factory = ENEMY_FACTORIES.get(class_type)
    if factory is None:
        raise ValueError(f"알 수 없는 적 클래스입니다: {class_type} (사용 가능: {', '.join(TRAINABLE_ENEMY_TYPES)})")
    return factory(rng)
