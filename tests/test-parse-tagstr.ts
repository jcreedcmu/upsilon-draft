import { AttrString, Chars, Screen } from '../src/ui/screen';
import { parseTagstr } from "../src/ui/parse-tagstr";
import { ColorCode } from '../src/ui/ui-constants';

function parse(str: string): AttrString[] {
  return parseTagstr(str, { fg: ColorCode.bwhite, bg: ColorCode.black });
}

describe('screen utilities', () => {
  test('should handle tags correctly', () => {

    expect(parse('{white}hello\nworld{/}')).toEqual([
      { attr: { bg: 0, fg: 7 }, str: "hello\nworld" }
    ]);

    expect(parse('{black}{bg-white}hello\nworld{/}')).toEqual([
      { attr: { bg: 7, fg: 0 }, str: "hello\nworld" }
    ]);

    expect(parse('x{bg-bblue}hello world{/}!')).toEqual([
      { attr: { bg: 0, fg: 15 }, str: "x" },
      { attr: { bg: 12, fg: 15 }, str: "hello world" },
      { attr: { bg: 0, fg: 15 }, str: "!" }
    ]);
  });

  test('should handle entities correctly', () => {
    expect(parse('{lock}!')).toEqual([
      { attr: { bg: 0, fg: 15 }, str: Chars.LOCK },
      { attr: { bg: 0, fg: 15 }, str: "!" },
    ]);

    expect(parse('* {CHECKMARK}')).toEqual([
      { attr: { bg: 0, fg: 15 }, str: "* " },
      { attr: { bg: 0, fg: 15 }, str: Chars.CHECKMARK },
    ]);

  });
});
