// Phones only ever get Detailed mode: isPhone() and initialMode() with a mocked screen and pointer.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isPhone, initialMode } from '../js/modes.js';

const saved = { screen: globalThis.screen, matchMedia: globalThis.matchMedia, window: globalThis.window };
afterEach(() => Object.assign(globalThis, saved));

/** Mock a device: screen size, pointer type, URL query and the saved mode. */
function device({ w, h, coarse, search = '', stored = null }) {
  const store = new Map(stored ? [['pinned.mode', JSON.stringify(stored)]] : []);
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  globalThis.screen = { width: w, height: h };
  globalThis.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' ? coarse : false });
  globalThis.window = { location: { search, href: `https://example.test/${search}` }, localStorage };
  return store;
}

const PHONE = { w: 390, h: 844, coarse: true }; // iPhone 13, portrait
const PHONE_LANDSCAPE = { w: 844, h: 390, coarse: true };
const TABLET = { w: 820, h: 1180, coarse: true }; // iPad Air
const LAPTOP = { w: 1366, h: 768, coarse: false };
const NARROW_LAPTOP_WINDOW = { w: 1440, h: 900, coarse: false }; // window size is irrelevant: screen is used

test('M1. isPhone(): short side < 600 px AND a coarse pointer', () => {
  device(PHONE);
  assert.equal(isPhone(), true);
  device(PHONE_LANDSCAPE);
  assert.equal(isPhone(), true, 'landscape phone');
  device(TABLET);
  assert.equal(isPhone(), false, 'tablet');
  device(LAPTOP);
  assert.equal(isPhone(), false, 'laptop');
  device(NARROW_LAPTOP_WINDOW);
  assert.equal(isPhone(), false, 'narrow laptop window');
  device({ w: 390, h: 844, coarse: false });
  assert.equal(isPhone(), false, 'small screen with a fine pointer');
  device({ w: 1280, h: 800, coarse: true });
  assert.equal(isPhone(), false, 'large touch screen');
  delete globalThis.screen;
  assert.equal(isPhone(), false, 'no screen object (node)');
});

test('M2. initialMode() on a phone is always Detailed and saves nothing', () => {
  for (const d of [PHONE, PHONE_LANDSCAPE]) {
    let store = device({ ...d, search: '?mode=present' });
    assert.equal(initialMode(), 'detailed', '?mode=present ignored');
    assert.equal(store.size, 0, 'nothing saved');
    store = device({ ...d, stored: 'present' });
    assert.equal(initialMode(), 'detailed', "saved 'present' ignored");
    assert.equal(store.get('pinned.mode'), JSON.stringify('present'), 'saved choice left alone');
    device({ ...d });
    assert.equal(initialMode(), 'detailed');
  }
});

test('M3. initialMode() elsewhere is unchanged: URL, then saved choice, then Detailed', () => {
  for (const d of [LAPTOP, TABLET]) {
    device({ ...d, search: '?mode=present' });
    assert.equal(initialMode(), 'present');
    device({ ...d, search: '?mode=detailed', stored: 'present' });
    assert.equal(initialMode(), 'detailed');
    device({ ...d, stored: 'present' });
    assert.equal(initialMode(), 'present');
    device({ ...d });
    assert.equal(initialMode(), 'detailed');
  }
});
