import { colorCodeOfName, ncolors } from './ui-constants';
import { Attr, AttrString } from './screen';

class ParseError extends Error {

}

export function parseTagstr(str: string, init: Attr): AttrString[] {
  let attr = init;
  const rv: AttrString[] = [];
  while (str.length >= 0) {
    if (!str.match(/{/)) {
      rv.push({ str, attr });
      break;
    }
    const bgMatch = str.match(/^([^{]*?){bg-([^}]*?)}/s);
    if (bgMatch && ncolors.includes(bgMatch[2])) {
      rv.push({ str: bgMatch[1], attr });
      attr = { ...attr, bg: colorCodeOfName(bgMatch[2]) };
      str = str.substr(bgMatch[0].length);
      continue;
    }
    const match = str.match(/^([^{]*?){([^}]*?)}/s);
    if (match && ncolors.includes(match[2])) {
      rv.push({ str: match[1], attr });
      attr = { ...attr, fg: colorCodeOfName(match[2]) };
      str = str.substr(match[0].length);
      continue;
    }
    if (match && match[2] == '/') {
      rv.push({ str: match[1], attr });
      attr = init;
      str = str.substr(match[0].length);
      continue;
    }
    throw new ParseError(`don't know how to parse '${JSON.stringify(str)}'`);
  }
  return rv.filter(x => x.str != '');
}

export function parseTagstrSafe(str: string, init: Attr): AttrString[] {
  try {
    return parseTagstr(str, init);
  }
  catch (e) {
    if (e instanceof ParseError) {
      console.error(e);
      return [{ str, attr: init }];
    }
    else {
      throw e;
    }
  }
}
