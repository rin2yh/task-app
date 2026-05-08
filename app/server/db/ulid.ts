// `ulid` パッケージは module top-level で `factory()` → `detectPrng()` を呼び、
// Workers では window も Node の crypto も無いため throw する。
// crypto.getRandomValues を直接使う最小実装に置き換える。
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(time: number): string {
  let n = time;
  let out = '';
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = n % 32;
    out = ENCODING.charAt(mod) + out;
    n = (n - mod) / 32;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LEN));
  let out = '';
  for (const b of bytes) {
    out += ENCODING.charAt(b % 32);
  }
  return out;
}

export function ulid(): string {
  return encodeTime(Date.now()) + encodeRandom();
}
