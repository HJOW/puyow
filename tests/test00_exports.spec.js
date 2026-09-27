// ES Module와 CommonJS 번들의 공개 클래스 및 매니저 계약을 검사한다.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireBundle = createRequire(resolve('tests/test00_exports.spec.js'));
const classNames = [...readFileSync('src/js/puyow.js', 'utf8').matchAll(/^class (\w+)/gm)].map((match) => match[1]);

for (const runtime of ['원본', '번들']) {
  test(`${runtime}은 모든 클래스와 PuyoWManager 인스턴스를 공개한다`, async () => {
    const module = runtime === '원본' ? await import('../src/js/puyow.js') : null;
    const api = module ? module.default : requireBundle('../src/bundle/puyow.bundle.js');
    expect(api).toBeInstanceOf(api.PuyoWManager);
    if (module) {
      expect(module.PuyoW).toBe(api);
      expect(module.WebPuyo).toBe(api);
    }
    for (const name of classNames) {
      expect(typeof api[name], name).toBe('function');
      if (module) expect(module[name], name).toBe(api[name]);
    }

    // 새로 공개한 중간 클래스의 생성과 기존 상속·인스턴스 검사 계약을 확인한다.
    expect(new api.SlimePuyo('custom', '테스트 뿌요', 'red')).toBeInstanceOf(api.Puyo);
    expect(new api.TinyWarningPuyo()).toBeInstanceOf(api.WarningPuyo);
    expect(new api.Solomon()).toBeInstanceOf(api.Enemy);
    expect(new api.CommonSoundPool()).toBeInstanceOf(api.SoundPool);
    expect(new api.StorageManager()).toBeInstanceOf(api.StorageManager);

    const manager = new api.PuyoWManager();
    expect(manager).not.toBe(api);
    expect(manager.common).toBe(api.common);
    expect(manager.getCommonFunctions()).toBe(api.common);
    expect(manager.tools).toBe(api.tools);
    expect(manager.leaderboard).toBe(api.leaderboard);
    expect(manager.replay).toBe(api.replay);
    const previousPath = api.urlContextPath;
    const previousSoundPool = api.commonSoundPool;
    try {
      manager.setURLContextPath('/exports-test/');
      expect(api.urlContextPath).toBe('/exports-test/');
      expect(manager.convertURL('[CTX]asset.png')).toBe('/exports-test/asset.png');
      const { convertURL } = manager;
      expect(convertURL('[CTX]asset.png')).toBe('/exports-test/asset.png');
      const soundPool = new api.CommonSoundPool();
      manager.setCommonSoundPool(soundPool);
      expect(api.commonSoundPool).toBe(soundPool);
    } finally {
      manager.setURLContextPath(previousPath);
      manager.setCommonSoundPool(previousSoundPool);
    }
  });
}
