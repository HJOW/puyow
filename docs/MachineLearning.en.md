# Puyo W Machine Learning Tutorial

`learning.py` is a tool that trains a model to evaluate where to place puyos and saves it as a `.pt` file. In this document you will first run `lngui.py`, which you operate through a GUI, and then run the same local training from the command line with `learning.py`. You do not need to run the browser game or a server while training.

## 1. One-time setup

This document assumes Windows and PowerShell. The same commands also work in Command Prompt.

First install the following programs from their official sites. After installing, close any PowerShell or Command Prompt window you already had open and start a new one.

- Install **Python 3.10 or later** from the [Python downloads page](https://www.python.org/downloads/). Check the `Add Python to PATH` option on the installer screen.
- Install the LTS version from the [Node.js downloads page](https://nodejs.org/en/download). The trainer uses Node.js to read the actual game's fever patterns.
- If you don't already have the Puyo W project, install [Git for Windows](https://git-scm.com/install/windows) and get the project with the command below. If you already have the project folder, skip this step.

```powershell
git clone https://github.com/HJOW/puyow.git
cd puyow
```

If you ran the command above, you are already inside the project folder, so the move step below is not needed. If you already have the project folder somewhere else, move to that location as shown below. The path is just an example, so change it to match your actual install location.

```powershell
cd D:\Workspace\git\puyow
```

Check that the installs are recognized.

```powershell
python --version
node --version
```

You're done if each command prints a version number. If `python` is not found, open a new terminal and try again; if it still doesn't work, reinstall Python and make sure to check the PATH option. If only `py` works on your Windows machine, use `py` in place of `python` in the commands that follow.

Finally, install the required Python packages.

```powershell
python -m pip install --upgrade pip
python -m pip install torch psutil onnx onnxscript
```

`torch` is needed for training, and `psutil` is needed for the GUI's CPU/memory display. `onnx` and `onnxscript` are used when saving the model in ONNX (Open Neural Network Exchange) format.

If you have an NVIDIA GPU, check the [PyTorch get-started page](https://pytorch.org/get-started/locally/) for the install command matching your CUDA setup. If you're not sure, just start with the default install and CPU training described in this document.

## 2. Trying out `lngui.py`

First, run a short training session to confirm the install worked.

1. From PowerShell or Command Prompt, move to the project root.
2. Type the following command and press Enter.

   ```powershell
   python python/lngui.py
   ```

3. When the **Puyo W Model Trainer** window opens, change `Episodes` from `5000` to `10` for now (on Korean Windows, the window is titled **Puyo W 모델 학습기** and the field is labeled `에피소드 수`). An episode is one full simulated match the computer plays out.
4. Leave `Model output path` at its default value (`python\puyow\default.pt`) for now. To save to a different name or location, type a path or click `Browse...`.
5. Click **Start**. Training has begun once you see `Starting training` in the log and the progress bar starts moving.
6. Wait for it to finish. You're done once `Training finished and checkpoint saved.` appears in the log.

`lngui.py` is a **local training tool that does not take a server URL as input**. You don't need to run `pythonserver.py` or configure an API token.

On success, the following two files appear at the default path.

```text
python/puyow/default.pt
python/puyow/default.json
```

The `.pt` file is the trained model, and the `.json` file records the model version and input size.

## 3. Basic usage of `lngui.py`

The GUI has a model save path, an episode count, a training strategy, Start/Pause/Stop buttons, a progress bar, a log, and CPU/RAM readouts. **There is no server address field**; the GUI only ever runs local training. The seed, device, and opponent use `learning.py`'s defaults: `2026`, `auto`, and `random`.

The window's text is shown in Korean when the operating system's display language is Korean, and in English otherwise. You can switch between `English` and `한국어` at any time from the `Language` menu (shown as `언어 (Language)` in Korean). On Windows, Korean text is drawn with the `python/PretendardVariable.ttf` font, which does not need to be installed; other operating systems use their system fonts.

The table below uses the English names. In Korean they appear as `모델 저장 경로`, `에피소드 수`, `학습 방식`, `시작`, `일시정지`/`재개`, `중단`, and `파일 > 다른 이름으로 저장...`/`종료`. The training log written by the trainer itself is always in Korean, regardless of the language setting.

| Field | What it does |
| --- | --- |
| `Model output path` | The `.pt` file path where the training result is saved. You can also pick it with `Browse...`. |
| `Episodes` | The number of matches to train on. Only a positive integer is accepted. Use 10 to verify the install and a larger value such as 1000 or more for real training. |
| `Training strategy` | Picks the training strategy. The default, `Standard`, trains the same way as before. A description of the selected strategy is shown under the combo box. See "Training strategies" in section 8 for details. |
| `Start` | Starts training. The path, episode count, and training strategy cannot be changed while training is running. |
| `Pause` / `Resume` | Pauses or resumes after the current episode finishes. |
| `Stop` | Stops after the current episode finishes and saves the model up to that point. |
| Progress bar and log | Shows completed episodes, win/loss counts, errors, and save results. |

The `File` menu is also available.

- `File > Save As...`: copies the finished model to another `.pt` file, or converts it to a `.onnx` file. ONNX conversion requires the `onnx` and `onnxscript` packages.
- `File > Exit`: if training is running, saves the model after the current episode finishes and then closes the window.
- The **X** at the top right of the window: closes immediately without saving the current training result. It also does not modify any existing model file.

Training again with the same `Model output path` loads the existing `.pt` file's weights, continues training from there, and saves back to the same path on a normal finish. To keep the original file, choose a different filename before starting.

## 4. Running `learning.py` from the command line

Once the GUI works correctly, you can run the same local training from the command line. From the project root, type the following command.

```powershell
python python/learning.py --episodes 10 --output python/puyow/first-model.pt --device auto
```

You're done once you see `episode=...` log lines and `saved=python/puyow/first-model.pt` at the end. After confirming the install works, change `--episodes 10` to whatever count you want. For example, to train the default file for 1000 matches, run:

```powershell
python python/learning.py --episodes 1000 --device auto
```

Every command in this section is local training that runs without a server. When it finishes, a `.pt` model file and a `.json` metadata file with the same name are saved at the `--output` path. If you point `--output` at a `.pt` file that already exists, training continues from that model.

Command-line training saves only once, at the very end after all episodes finish, so if you force-quit with `Ctrl+C` partway through, none of the training done so far is saved at all. So rather than force-quitting, it's safer to try a small `--episodes` value first.

## 5. `learning.py` options

You can also see the full option list with:

```powershell
python python/learning.py --help
```

| Option | Default | Description and example |
| --- | --- | --- |
| `--episodes N` | `1000` | Number of episodes to train. Must be 1 or more. Example: `--episodes 5000` |
| `--seed N` | `2026` | Random seed. Fix this when comparing results under the same conditions. Example: `--seed 42` |
| `--output PATH` | `python/puyow/default.pt` | The file the model is saved to. If the file already exists, its weights are loaded and training continues from there. Example: `--output python/puyow/kimaris.pt` |
| `--device auto\|cpu\|cuda` | `auto` | The compute device. `auto` picks the GPU if CUDA is available, otherwise the CPU. Use `cpu` if you're unsure about your GPU setup. |
| `--opponent VALUE` | `random` | The training opponent. See the opponent table in the detailed section below. Example: `--opponent Kimaris` |
| `--training-strategy VALUE` | `standard` | The training strategy: one of `standard`, `chain-guided`, `chain-curriculum`, `long-nstep`, `chain-all`, `solo-play`, or `alternate-model`. `solo-play` and `alternate-model` also pick the opponent, so they take precedence over `--opponent`. See "Training strategies" in section 8. Example: `--training-strategy chain-all` |
| `--server-url URL` | none | Sends training events to `pythonserver.py`. Leave unset for ordinary local training. See the server section further below for details. |
| `--api-token TOKEN` | none | The authentication token used with `--server-url`. Can also be set via the `PUYOW_AI_TOKEN` environment variable. |
| `--evaluate-episodes N` | `0` | Evaluates the saved model instead of training. Setting this to 1 or more prints wins/losses/draws/win rate and the chain distribution as JSON (see section 13). |
| `--infer-observation JSON_FILE` | none | Runs a single inference on one observation JSON using the saved model, without training. |
| `--export-gguf MODEL_DIR` | none | Converts a Hugging Face Transformer model to GGUF. This cannot be used on `.pt` files produced by this trainer. |
| `--gguf-output PATH` | `python/model-f16.gguf` | The output file path for `--export-gguf`. |
| `--llama-cpp-converter PATH` | `llama.cpp/convert_hf_to_gguf.py` | The path to the llama.cpp conversion script used for GGUF conversion. |

`--export-gguf`, `--infer-observation`, and `--evaluate-episodes` each run a conversion, an inference, or an evaluation instead of training. Use only one of them at a time.

## 6. Training details: training by dueling the enemy AIs

`python/bundledenemy.py` is a module that ports the decision-making algorithms of the built-in enemies from `src/js/puyow.js` (Dantalion, Seere, Decarabia, Belial, Amdusias, Kimaris, and Andrealphus) to Python. Solomon (which only works through an external AI API) and Andromalius were excluded from the port, and while a class for Flauros was carried over, it's left out of the opponent list because — just like in the original — it doesn't have decision logic yet and is still marked as upcoming. Use the `--opponent` option to choose who to duel during training.

| Value | Behavior |
| --- | --- |
| `random` (default) | Each episode randomly chooses either self-play (against itself) or one of the ported enemies to duel. |
| `self` | Always duels via self-play. Since the opposing side also picks actions using the policy being trained (applying the same epsilon-greedy exploration), the opponent winning is effectively the same policy losing to itself. |
| `solo` | Uses the old mode (`PuyoEnvironment`), which trains only to survive without an opponent. |
| `Dantalion`, `Seere`, `Decarabia`, `Belial`, `Amdusias`, `Kimaris`, `Andrealphus` | Fixes the opponent to the specified enemy for the whole run. |
| `QuietEdgeEnemy` | Duels a training-only sparring opponent that avoids popping puyos and fills the columns farthest from the centre (X=2,3) first. It does not exist in the game itself, so `random` never picks it. `--training-strategy solo-play` selects it automatically. |

```powershell
python python/learning.py --episodes 1000 --opponent Kimaris
```

For anything other than `solo`, the training environment is `PuyoDuelEnvironment`: every time the agent makes and resolves a move, the opponent (an enemy AI or the self-play policy) immediately makes its own move as well. It also simulates the ATTACK/garbage-puyo exchange between the two boards, so beating the opponent (its board touching the losing cell, or it having no legal move left) gives a large reward, and losing gives a large penalty.

In duel modes other than `solo`, the following values are also chosen at random for every episode, independently of the opponent choice.

- **Rule**: standard rules or fever rules, each with a 50% chance. Fever rules run the split between the normal field and the fever field, the 7-hit offset gauge, each player's next fever timer, the time limit, target-chain changes, and enemy decisions that prioritize the largest chain while in fever. Fever patterns aren't a separate copy — at runtime, the actual game's 54 fever stage entries are read via `PuyoW.common.getFeverStageDefinitions()` and laid out to match the chosen color count and supplied pair.
- **Color count**: one of 3, 4, or 5 colors is chosen at random, and puyo pairs are generated using only that many colors (the observation vector's channel count is always fixed for 5 colors; unused channels are simply left at 0).

The browser game feeds the actual elapsed milliseconds from `game.elapsed` into the observation. Wall-clock time is meaningless for offline training, which runs as fast as the CPU allows, so each pair of turns (one from each side) is treated as 3 seconds, and the margin rate, time-progress multiplier, and fever time limit are all advanced deterministically from that.

## 7. Details: running with the server API

To use server-transmission mode, first run [python/pythonserver.py](../python/pythonserver.py). Before running it, set `SERVER_CONFIG["learning_token"]` at the top of the file directly to the same token the trainer will use. This is a development-only setting; a public-facing server should not keep the token in source code. The current implementation only checks a single string token — the OR-based authentication over multiple API keys (a token collection) noted in the TODO has not been implemented yet.

Requests from localhost or a loopback address (`127.0.0.1`, `::1`, etc.) are an exception. If the CLI sends `"localhost"` as the token, it is accepted regardless of the value configured in `SERVER_CONFIG["learning_token"]`. `lngui.py` never uses this server integration, since it's a local training tool that doesn't take a server URL as input. This exception does not apply to non-loopback addresses or to a token that is wrong and not `"localhost"` — those are rejected as usual. An empty-string token is not covered by this exception either, so it is rejected even from loopback.

Run the Python server:

```powershell
python python/pythonserver.py 9891
```

If you omit the port number, the default from `SERVER_CONFIG["port"]`, `9891`, is used.

With the server running, open another PowerShell window and run the CLI trainer.

```powershell
python python/learning.py `
	--episodes 1000 `
	--server-url http://localhost:9891 `
	--api-token localhost `
	--device auto
```

For a remote server, set `--api-token` to the same value as the Python server's `SERVER_CONFIG["learning_token"]`.

```powershell
python python/learning.py `
	--episodes 100 `
	--server-url http://localhost:9891 `
	--api-token "the token you set in SERVER_CONFIG" `
	--output python/experiment.pt
```

When a server URL is given, each episode sends `POST /apis/learning` requests in the following order.

1. `reset`: sends a new session ID and the initial observation.
2. `step`: sends the current observation, action, reward, next observation, and whether the episode is done.
3. `episode_end`: sends the end-of-episode signal.

All requests include the following authentication headers.

```text
Authorization: Bearer <SERVER_CONFIG["learning_token"]>
Content-Type: application/json
```

If a server request fails, or the server returns `ok: false`, the trainer also exits with an error. This is so training doesn't keep going with lost training data.

## 8. Details: how training works

For this game, the resulting board after a move (landing, popping, chains, ATTACK) can be computed exactly from the rules alone. `python/bundledenemy.py` carries those rules over as-is, and both the trainer and the server use the same functions. Training is designed around that fact.

- **Afterstate value learning**: the network outputs only a single `V(state right after a move)`. To actually pick a move, every legal candidate placement's resulting board is computed via the rules, and the candidate that maximizes `immediate reward + discount rate × V(resulting state)` is chosen. This means the network never has to relearn what the rules already determine, and since all 24 actions share a single value function, learning is much faster for the same number of matches. Placements that aren't legal are excluded when building candidates, so the model never learns or picks an impossible placement.
- **The pair recorded in the resulting state is the "next pair"**: an afterstate is effectively "my state as the next turn begins," so the slot for the current pair in the observation vector actually holds the pair after this move. This means evaluating just one move already accounts for the pair that comes next. This is the same value found in `next_1` of the `suppliedPuyos` that the game's Solomon prompt already sends.
- **A convolutional network that sees the board in 2D as-is**: instead of flattening the 6×12 board into one dimension, it's fed into the convolution as-is, across 7 channels (empty, garbage, and the 5 colors). Whether same-colored puyos are adjacent, or which column is taller, are the kinds of chain-relevant features that stay the same regardless of where they occur on the board. The current pair and the 24 scalar state values are concatenated after the features that come out of the convolution.
- **n-step targets**: because chains build up over several moves before popping all at once, the target value is built not from just the next move but by chaining together the actual rewards over up to `learning.N_STEP_RETURN` (3 by default) moves. This lets reward propagate back to earlier moves that much faster.
- **Reward contract**: the immediate reward for one move is `ATTACK + chain weight`, from `common.move_reward()`. The chain weight is `common.chain_reward()`: `5 x chain^2` outside fever, and one fifth of that (`1 x chain^2`) during fever, because a fever field arrives with the target chain already laid out, making the same chain easier than one you built yourself. The discount rate is `common.DISCOUNT_GAMMA` (0.70). Offline training, server inference, the server's online training, and browser ONNX inference all share this contract.
- **Win/loss is the value of the final state**: winning (`+245`, `WIN_REWARD`) and losing (`-245`, `LOSS_REWARD`) are trained not as the reward for the last move, but as **the value of the state where the match ended**. If they were given only as a reward, a dead board's value would end up at 0, which would create a problem where, among the candidates, "the move that loses the instant you play it" could look better than a safe move. 245 is the weight of a 7-chain outside fever (`5 x 7^2`), which means winning a match is valued the same as landing one 7-chain.
- **Game time**: the terminal value also carries an elapsed-time adjustment (`common.terminal_reward()`). A win scores higher the sooner it arrives; a loss scores higher the longer the agent held out. Its size is calibrated so that a 2-chain outside fever (20) equals 120 seconds of game time, which keeps it far below the chain and win/loss weights, and it is clamped at the same 10-minute ceiling as the `elapsed_ms` observation scalar. The time adjustment therefore never flips the sign of a win or a loss.
- **Exploration**: during training, a candidate is picked at random with a certain probability. That probability starts at 1.0 and decays down to 0.05 by the halfway point of all episodes, so for the remaining half, the model is playing almost entirely on its own judgment. Even when picking randomly, only legal candidates are considered.

Garbage-puyo drops are random, so they aren't reflected in the afterstate — only the remaining damage after any offsetting is kept as a scalar in the state. Because this approximation is applied through the same function (`learning.enumerate_afterstates()`) in both the trainer and the server, it's applied identically on both sides.

### Training strategies

You can pick a training strategy with the `Training strategy` combo box in `lngui.py` or the `--training-strategy` option of `learning.py`. The default, `standard`, trains exactly as before this option existed. The first four strategies change the training process to encourage longer chains; the last two change the opponent.

| Value | GUI label (English / Korean) | Behavior |
| --- | --- | --- |
| `standard` (default) | `Standard` / `기본` | The previous behavior: exploration picks a random placeable move, and the n-step return is 3. |
| `chain-guided` | `Chain-guided exploration` / `연쇄 유도 탐험` | Half of the exploration moves follow the placement of a chain-building enemy AI. The guide is chosen per episode from Amdusias, Kimaris, and Andrealphus. Random exploration alone almost never produces chains of 5 or more, so the value network has a hard time learning what a board with a chain built up is worth. |
| `chain-curriculum` | `Chain curriculum` / `연쇄 커리큘럼` | 30% of episodes start from a field with a real fever pattern laid out as a chain seed, and 20% are played `solo`, with no garbage exchange. The seed's colors are shuffled at random, so it doesn't pop right away; the trigger colors have to be lined up over several moves. |
| `long-nstep` | `Long n-step return` / `긴 n스텝 목표값` | Value targets chain together the actual rewards of up to 8 moves instead of 3, so chain rewards propagate back to earlier moves faster. |
| `chain-all` | `All chain strategies` / `연쇄 방식 모두 사용` | Uses all three strategies above together. |
| `solo-play` | `Solo play` / `솔로 플레이` | Duels only the sparring opponent (`QuietEdgeEnemy`) that avoids popping puyos and fills the columns farthest from the centre (X=2,3) first. Because it barely attacks, the model can practise building and firing its own chains without being pressured by garbage. |
| `alternate-model` | `Play against saved models` / `대체 모델과 플레이` | Faces one of the `modelNN.pt` checkpoints in `python/puyow/`, drawn at random each episode. See the notes below. |

```powershell
python python/learning.py --episodes 5000 --output python/puyow/chain.pt --training-strategy chain-all
```

- Every strategy changes **only the training process and the opponent**. The reward, the discount rate, and the observation/action contract stay the same, so a model trained with any strategy works as-is for server and browser inference, and an existing model can continue training with a different strategy.
- Conversely, the criterion for judging "the best move" itself does not change. These strategies help the model reach that criterion faster and more reliably. Compare their effect with the chain distribution from `--evaluate-episodes` (see section 13).
- `chain-guided` asks an enemy AI to decide on every guided exploration move, so the early part of training, where the exploration rate is high, runs slower.
- The chain seeds of `chain-curriculum` read the fever patterns from the game source the same way fever rules do, so Node.js is required. `solo` episodes can't be won, so the win count in the log drops accordingly.
- The training log also prints each episode's longest chain as `max_combo=`.

`alternate-model` picks its opponent by these rules.

- Candidates are only the files **directly under** `python/puyow/` whose names match `modelNN.pt` (two or more digits, e.g. `model01.pt`, `model02.pt`, `model100.pt`). Only the filename is checked at this stage; the checkpoint contents are not. `default.pt` does not match the naming rule and so never becomes an opponent.
- If there is no usable file at all, training fails before it starts and the `--output` checkpoint is left untouched.
- One of the remaining candidates is drawn at random each episode. The draw derives from the training seed, so it is reproducible.
- If loading the opponent model or asking it for a move raises an error, **that whole episode is discarded**: its partial trajectory never becomes a training sample and never enters the win/loss counts, `alternate_model_failed` is written to the log, and that file is dropped from later draws.
- Once every candidate has been dropped, the trainer logs `alternate_model_exhausted` and stops. The weights learned up to that point are still saved to `--output`.
- The opponent model uses the same `ValueNetwork`, afterstate, and action-number contract as the agent being trained, and picks its moves greedily (no exploration) from the observation of its own field.

```powershell
python python/learning.py --episodes 2000 --output python/puyow/default.pt --training-strategy alternate-model
```

## 9. Details: observations and actions

The current Python environment's model-version-3 observation vector has a length of `528` (the same contract as version 2).

- One-hot channels for empty cells, garbage, and the 5 puyo colors across the 6×12 board: `504` values
- One-hot info for the two colors of the current pair: `10` values
- Normalized battle/rule/time/fever state: `14` values, in this order — ATTACK, turn, DAMAGE, whether fever rules are active, all-clear ticket, elapsed time, margin rate, time-progress multiplier, fever active, gauge, next fever time, target chain, time left, and fever DAMAGE.

Board coordinates are `board[y][x]`, with `y=0` at the bottom. The action number is computed as `column * 4 + rotation`.

- Column: `0` to `5`
- Rotation: `0` to `3`
- Total number of actions: `24`

The same observation and action contract is used for data sent to the `pythonserver.py` API as well.

## 10. Details: browser game state

Instead of a separate learning-only API, `PuyoW.getGameState()` is used both to extend the browser-based training environment and to develop enemy AI. This function returns a read-only snapshot — mutating the returned object does not change the game's internal state — and it returns `null` when there is no active game or a tutorial is in progress. `learning.py`'s standalone `PuyoDuelEnvironment` does not call this API at all; it simulates the Python board directly. The state described below is the common query contract used when extending functionality on the browser side.

```js
const state = window.PuyoW.getGameState();
```

The top-level `mode` is one of `versus`, `practice`, `watch`, `continuous_fever`, or `puzzle`, and `rule` is one of `standard`, `fever`, `fever_start`, or `continuous_fever`. `allClearTicketEnabled` indicates that the all-clear ticket is exclusive to standard rules.

`player` and `opponent` each contain the following state, in the same shape.

- `board`: the list of placed puyos on the currently active field. During fever, this is the fever field.
- `normalBoard`: the list of placed puyos on the normal field, kept regardless of whether fever is active.
- `fever`: fever state for both sides. `leftTime` is that player's remaining fever time, and `field.puyos` is the list of placed puyos on the fever-only field, kept regardless of whether it's active. `field.cells` is also provided for compatibility.
- `allClearTicket`: whether an all-clear ticket is held, to be used on the next color-puyo pop, under standard rules.
- `nextPairs`: only the next two pairs after the current move are provided for both sides. The full internal queue used for CPU search is not exposed.

The remaining time and target state for continuous fever are found in the existing top-level `fever.leftTime`, `fever.targetCombo`, and so on. `/apis/learning` and the Solomon placement request use the same 528-value observation contract, and `currentState.elapsedMs` in the Solomon prompt is the actual `game.elapsed` managed by the JS game loop.

## 11. Details: current implementation scope

The current training environment implements: connected pops and chains of normal color puyos, gravity, the losing position, normal garbage-puyo exchange, the all-clear ticket under standard rules, time-based margin/attack multipliers, fever rules based on the actual game's patterns, duels against ported enemy AIs or self-play, and per-episode random selection of the rule and color count. The following parts are intentionally out of scope for now.

- Hard garbage puyos and iron puyos (simulator-only)
- Continuous-fever-only mode (duel training targets standard rules and fever rules)
- Collecting state from, and injecting actions into, the actual browser game loop
- Andrealphus's asynchronous 3-move Worker search (currently replaced with a synchronous, time-limited search)

The current `/apis/learning` API only receives training events and keeps session statistics; transitions received through this path do not change the model's weights. `src/js/puyow.js` sends the actual placement and settlement results from a user's game through this same API contract, and sending is only enabled once `configureLearningApi()` is called in the browser. The only path that actually updates the model's weights is `/apis/solomonlearning`, described above in "Training live by dueling Solomon."

To send a real user's play transitions from the browser game, call the public configuration function before the game initializes. Don't hard-code the token into the page source — inject it safely from your development environment instead.

```html
<script>
	window.PuyoW.configureLearningApi({
		serverUrl: "http://localhost:9891",
		token: "change-this-token"
	});
	window.PuyoW.initialize(document.getElementById("puyow_target"));
</script>
```

Once configured, the following events are sent automatically during an ordinary user's game.

- `reset` when the first puyo pair is locked in
- `step` on the next move's turn, once puyo pops, gravity, and damage settlement have finished
- `episode_end` once win/loss processing finishes

Practice, watch, and how-to-play modes are excluded from training sessions.

## 12. Details: training live by dueling Solomon

If you set the AI provider to **Local AI**, duel the enemy **Solomon** at **extreme** difficulty, and turn on the **`Train model in reverse`** checkbox on the settings screen (color count and rule don't matter), the moves from that match are used to continue training the model loaded on the server. Solomon's placements are already decided by this server's model in the first place, so this effectively feeds the outcome of a real match against a human back into that same model. On top of that, **in a match the human wins, the moves the human made** are also treated as a winning sequence — as if the model had controlled the player's side and won — and trained on together.

`Train model in reverse` is off by default. When it's off, this entire feature does nothing, including training on Solomon's own moves: no training session ID is attached to the Solomon placement prompt, no request is sent to `/apis/solomonlearning` when the match ends, and the weights of the model loaded on the server stay unchanged. The "in reverse" in the checkbox's name means that, unlike the usual offline batch training you do with `learning.py`, this updates the model that's actually in service, live, in place, during the match.

What you need to prepare is the same as the "Dueling the game with your trained model" section below. Run `pythonserver.py`, choose Local AI in the game settings, turn on `Train model in reverse`, then on the enemy-selection screen set the AI difficulty to extreme and pick Solomon.

Here's how it behaves.

1. The game creates a training session ID per match and sends it along with the Solomon placement request. For matches that don't meet the conditions (a different provider, a difficulty other than extreme, an enemy other than Solomon, or `Train model in reverse` turned off), this value is not sent, so the request is exactly the same as before.
2. On every request, the server stores the afterstate and immediate reward (`ATTACK + chain weight`) of the move it chose, in order, in the session. Because this uses the same function as offline training, the training sample format is identical between the two paths.
3. Training doesn't happen on every move. Once the win/loss is decided, **at the moment the game-over screen appears**, the moves collected from that match are turned into samples and applied all at once, and the result is saved to the checkpoint at `SERVER_CONFIG["model_path"]`. The target value for a move is the reward of the very next move plus the discounted value of the following afterstate; the last move has no further state to look ahead to, so only the terminal value that combines win/loss and elapsed time (`common.terminal_reward()`, +245 for a win before the time adjustment) becomes its target. The elapsed time is read from that side's last recorded move.
4. There is no request at all for a turn where Solomon fell back to an alternative AI due to a dangerous board height or a response error. Since the move right before such a turn has no known next state, it is not turned into a sample.

### Also training on the moves from a match the human won

There is no value in the observation vector or the action number that indicates "who made this move." Both sides use the same self-centered representation — only their own field, their own current pair, and their own state — so a move the human made can be turned into exactly the same kind of transition as a move Solomon made. This is what lets the moves from a match a human won be fed back into the model.

This sub-feature has no separate setting of its own. The single `Train model in reverse` checkbox described above turns both Solomon's own training and the human's move training on and off together.

1. Every time the human locks in a puyo during the match, the game sends the observation and placement (`column*4+rotation`) at that moment to the same training session. Since Solomon's moves and the human's moves don't lead into each other's next state, they're accumulated **separately, per side**, within the session.
2. Just like Solomon's moves, the server recomputes the afterstate and the `ATTACK + chain weight` reward for the human's moves as well. This keeps the basis for the value estimate from skewing toward one side. The request for a move the human made also carries that move's next pair (`nextPair`), and the server places that value into the afterstate's current-pair slot.
3. When the match ends, **only if the human won**, the human-side samples are added to training with the winning terminal value (+245 before the time adjustment) attached to the last move. The human-side moves from a match the human did not win are simply discarded.
4. The human's winning sequence is trained with a higher weight than Solomon's own moves. This weight is controlled by `pythonserver.py`'s `SOLOMON_PLAYER_WIN_TRAINING_WEIGHT` (`10.0` by default), while Solomon's own moves always use `1.0`. The higher this value, the more strongly the model follows the human's winning sequence, and setting it to `1.0` trains both sides with equal weight.

The weights are normalized to average 1 before the loss is computed, so changing the value doesn't require re-tuning the learning rate. In a match with no human-side samples, every weight becomes 1, so it behaves exactly like existing training.

When using Local AI, the game also sends the list of placements actually usable this turn (`usablePlacements`). The observation the server receives only contains the visible 12 rows, so it can't tell whether a puyo can move horizontally to reach a target column, whether it gets pushed by a wall kick during rotation, or whether there's room in the hidden rows above the visible field. When this list is provided, the server only picks the highest-value placement from within it, so it never responds with coordinates the game can't actually use and never triggers a pause from the "the returned Solomon placement cannot be used for the current puyo" error. This field is not included in prompts sent to other AI providers.

The save format is the same one `learning.py` uses, and it keeps the same model version, observation vector, action count, and seed, so a model updated this way can still be trained further with `learning.py`, or used as-is in another game session. Saving writes to a temporary file first and then swaps it in, so if the server stops mid-save, the existing model file is not corrupted.

The training result is logged to the game's browser console as `솔로몬 학습 적용 결과` ("Solomon training result"), where you can check the number of samples applied (`transitions`), how many of those were the human's moves (`playerTransitions`), and the final loss value. If this request fails, it does not affect gameplay.

## 13. Details: dueling the game with your trained model

To use `default.pt` as the game's AI provider, you don't run the actual LM Studio app — you run `pythonserver.py`, which only imitates the Chat Completions format.

1. In [python/pythonserver.py](../python/pythonserver.py)'s `SERVER_CONFIG`, set `model_path` to your trained `.pt` file, and set `learning_token` to the API key string you want to use. The default `model_path` is `python/puyow/default.pt`.
2. Run the server with `python python/pythonserver.py 9891`.
3. In the game settings, choose **LM Studio** as the AI provider, set the URL to `http://localhost:9891`, and set the API key to the same value as `learning_token`. For the model name, enter any non-empty string (e.g. `puyow-dqn`). The game client appends `/v1/chat/completions` to the URL when making requests.
(If you're playing locally, you can also enter `localhost` as the API key.)
4. After saving the settings, go back into the settings screen and click the "Test AI API" button. Once the test result appears as a message after a few seconds, go through the main menu into a game and choose the enemy "Solomon."

```
Example settings for local play
AI service provider: LM Studio
AI API URL: http://localhost:9891
AI API KEY: localhost
Model name used: puyow-dqn
```

If `model_path` is empty or points to a file that doesn't exist, only `/v1/chat/completions` returns 404. Static file serving and the `/apis/learning` training-event API keep running even in this case.

[nodeserver.js](../nodeserver.js), started with `npm start`, provides the same `/apis/localmodelinfo` and `/v1/chat/completions` contract, so you can choose **Local AI** in the game settings and play against Solomon without Python. Instead of a `.pt` checkpoint, this server runs [src/onnx/default.onnx](../src/onnx/default.onnx) with `onnxruntime-node`, which `npm install` installs; change the model path with the `LOCAL_AI_MODEL_PATH` constant in `nodeserver.js`. If no file exists at that path, `/apis/localmodelinfo` returns `available: false` so the game cannot select Local AI, while static files and the other APIs keep working. The placement rule (afterstate reward + 0.70 × value) is the same as `pythonserver.py`. Reverse training is not supported: `/apis/solomonlearning` only accepts requests and never changes the model.

To run inference on a single observation vector without a server, prepare a JSON array of 528 numbers and run:

```powershell
python python/learning.py --output python/puyow/default.pt --infer-observation observation.json
```

The result is JSON with `action`, `x`, and `rotation`; actions that would fill a full column or intrude on a wall are excluded from the candidates entirely. To evaluate on the same basis as a real match, include the next pair as well, using `{"observation": [...], "nextPair": [3, 4]}` instead of a bare array (color numbers are 0–4, in the order red, green, yellow, blue, purple).

To check the epsilon=0 win rate without training, use:

```powershell
python python/learning.py --output python/puyow/default.pt --evaluate-episodes 100 --opponent random
```

Besides wins, losses, draws, and win rate, the output JSON contains chain statistics for the model being evaluated. Use them to compare whether a training strategy made the model go for longer chains.

| Key | Contents |
| --- | --- |
| `average_max_combo` | The average of each episode's longest chain |
| `max_combo_distribution` | For each longest-chain length per episode (`0` if no chain was made at all), the number of episodes |
| `average_combo` | The average chain length over moves that actually popped. `0` if nothing popped |
| `combo_distribution` | For each chain length among moves that actually popped, how many times it happened |

## 14. Reference: help

You can see the full option list with:

```powershell
python python/learning.py --help
```

## 15. Reference: GGUF conversion

The GGUF format that LM Studio loads is not made by simply renaming an ordinary PyTorch file's extension. As with the referenced approach, you need to use `llama.cpp`'s `convert_hf_to_gguf.py` tool to convert a Hugging Face model directory that contains a `config.json` and Transformer weights.

`learning.py` includes an export path that calls this converter.

```powershell
python python/learning.py `
	--export-gguf models\my-transformer `
	--llama-cpp-converter llama.cpp\convert_hf_to_gguf.py `
	--gguf-output python\my-model-f16.gguf
```

The directory you convert must contain at least a `config.json` and that model's Transformer weight files. The default output format is `f16`. From there, you can convert further into a supported quantized format in LM Studio as needed, or use an already-quantized GGUF file directly.

The `default.pt` that `learning.py` currently trains is a checkpoint for `ValueNetwork`, a custom convolutional value network. It is not a language-model architecture like Llama, so it cannot be used directly with `convert_hf_to_gguf.py` or the actual LM Studio app. That said, even if you choose the LM Studio provider in the game settings, pointing the URL at `pythonserver.py` lets this server serve the model as-is, matching only the Chat Completions spec. To load it into the actual LM Studio app, you would need a separate Transformer-based model along with a training/conversion pipeline suited to it.
