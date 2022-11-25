import { AttrString, parseStr, Screen } from '../src/ui/screen';
import { ColorCode } from '../src/ui/ui-constants';

function parse(str: string): AttrString[] {
  return parseStr(str, { fg: ColorCode.bwhite, bg: ColorCode.black });
}

describe('screen utilities', () => {
  test('should handle tags correctly', () => {

    expect(parse('{white}hello\nworld{/}')).toEqual([
      { attr: { bg: 0, fg: 7 }, str: "hello\nworld" }
    ]);

    expect(parse('x{bg-bblue}hello world{/}!')).toEqual([
      { attr: { bg: 0, fg: 15 }, str: "x" },
      { attr: { bg: 12, fg: 15 }, str: "hello world" },
      { attr: { bg: 0, fg: 15 }, str: "!" }
    ]);

  });
});
