# Puyo W

A 2D Puyo-versus puzzle game you can enjoy in your browser. The player uses the field on the left, while the CPU opponent uses the field on the right. Connect Puyos of the same color to create chains, send garbage Puyos to your opponent, and block their field before they block yours.

## 한글로 작성된 문서가 필요한가요?

[한글 README](README.md)

## Play Now

Visit [https://hjow.github.io/puyow/](https://hjow.github.io/puyow/) to play.

## Starting the Game

Select `Start Game` on the main screen, choose a difficulty and opponent, and press `Start`. The match begins after a three-second countdown. At first, only Andromalius is available; after you win, the next opponents unlock in order.

Select `Practice` to play freely against a practice opponent that does not attack. The `GitHub` button in the lower-left corner of the main screen opens the project repository in a new window.

## Controls

| Key | Action |
| --- | --- |
| Left/Right Arrow | Move the Puyo pair left or right |
| Down Arrow | Move down quickly |
| Z | Rotate left |
| X | Rotate right |
| ESC | Open the pause screen during a game |
| Enter | Activate the focused button in menus and on the pause screen |

On the pause screen, use the arrow keys to choose `Resume` or `Quit`, then press `Enter`. On the game-over screen, click the `Quit` button in the center, or press `Enter` or `ESC` to return to the opponent selection screen.

## Game Rules

- Each player plays on a field that is 6 cells wide and 12 cells high.
- Four or more Puyos of the same color connected horizontally or vertically explode. This awards points and allows you to attack your opponent.
- Attacks generate garbage Puyos in your opponent's field.
- The longer the chain created by Puyo explosions, the more dramatically the score and attack power increase.
- You lose if a Puyo occupies the third cell from the top of the visible field.

## Match Flow

When Puyos are locked into place, gravity is applied to the field and the game checks whether any Puyos will explode. The chain count increases as explosions and falls repeat. Once all chains are complete, any remaining attack is sent to the opponent. Garbage Puyos that you receive fall from the top of the field on your next turn.

If you completely clear the field of both Puyos and garbage Puyos, an All Clear is triggered and sends heavy damage to your opponent. However, All Clear only activates after you have placed Puyos at least once.

## Screen Guide

The top center displays the player's and CPU's next two Puyo pairs. The selected opponent's portrait appears in the middle, and both players' scores are shown at the bottom. When Puyos explode, the chain count appears at the explosion location, floats upward, and disappears after two seconds.

## Installation for Local Development

1. Install Git and Node.js.
   - Git - [git scm](https://git-scm.com/install/windows)
   - Node.js - [Node.js](https://nodejs.org/ko/download) - On Windows, use the installer (`.msi`) version.
2. Clone the repository with Git.
   Open Command Prompt (Windows) or a terminal (macOS/Linux), navigate to the directory where you want to install PuyoW, and enter the command `git clone https://github.com/HJOW/puyow.git`, then press Enter.
3. Install the npm packages.
   In Command Prompt (Windows) or a terminal (macOS/Linux), enter the command `npm install`, then press Enter.

## Running Locally

1. Start the server.
   Open Command Prompt (Windows) or a terminal (macOS/Linux), navigate to the directory where PuyoW is installed, and enter the command `npm start`, then press Enter.
2. Connect and play.
   Open a web browser (Google Chrome, Microsoft Edge, Naver Whale, Mozilla Firefox, etc.), go to `localhost:9891`, and enjoy the game.
3. Exit the game.
   Close the web browser, then press `CTRL + C` in Command Prompt (Windows) or the terminal (macOS/Linux).

## Development Guide

See [HOWTO.en.md](HOWTO.en.md) for information about game settings, library usage, and creating new AI opponents.

## Source directory structure

- The repository-root `index.html` redirects to `src/index.html`.
- `src/puyow.html` is the 2D game page, and the core library is `src/js/puyow.js`.
- The stylesheet is in `src/css/puyow.css`; optional libraries are in `src/js/`; icons are in `src/img/`.
- Localized notices are in `src/notice/`, and the Webpack distribution bundle is in `src/bundle/`.

## AI Disclosure

AI tools were used during the development of this project. The project manager reviewed the generated or suggested code and documentation and adapted them to fit the project.

## License

This project is distributed under the [Apache License 2.0](LICENSE).

## Third Parties

+ Three.js (Optional, used only for some special effects)
  MIT License, Copyright © 2010-2026 three.js authors
  https://github.com/mrdoob/three.js/blob/dev/LICENSE

+ JSON5
  MIT License, Copyright (c) 2012-2018 Aseem Kishore, and others.
  https://github.com/json5/json5/blob/main/LICENSE.md

The MIT License

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
