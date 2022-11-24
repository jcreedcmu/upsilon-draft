import { translit } from '../src/util/alphabet';

describe('alphabet', () => {
  test('transliteration should work', () => {
    expect(translit('narta').split('').map(s => s.charCodeAt(0)))
      .toStrictEqual([145, 149, 157, 129, 149]);
  });
});
