import { parseStr, Screen } from '../src/ui/screen';
import { ColorCode } from '../src/ui/ui-constants';

// This describes current behavior, which is wrong
describe('screen utilities', () => {
  test('should handle tags correctly', () => {

    const parsed = parseStr('{white}hello\nworld{/}', { fg: ColorCode.bwhite, bg: ColorCode.black });
    expect(parsed).toEqual([
      { "attr": { "bg": 0, "fg": 15 }, "str": "" },
      { "attr": { "bg": 0, "fg": 7 }, "str": "world" },
      { "attr": { "bg": 0, "fg": 15 }, "str": "rld" },
      { "attr": { "bg": 0, "fg": 15 }, "str": "" }]
    );
  });
});
