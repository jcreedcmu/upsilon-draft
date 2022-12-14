import { colorCodeOfName, ncolors } from './ui-constants';
import { Attr, AttrString, Chars, isEntity } from './screen';

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
    const match = str.match(/^([^{]*?){([^}]*?)}/s);
    if (match) {
      const whole = match[0];
      const prefix = match[1];
      const tag = match[2];
      if (tag.startsWith('bg-')) {
        const color = tag.substring(3);
        if (ncolors.includes(tag.substring(3))) {
          rv.push({ str: prefix, attr });
          attr = { ...attr, bg: colorCodeOfName(color) };
          str = str.substr(whole.length);
          continue;
        }
      }
      if (ncolors.includes(tag)) {
        rv.push({ str: prefix, attr });
        attr = { ...attr, fg: colorCodeOfName(tag) };
        str = str.substr(whole.length);
        continue;
      }
      if (tag == '/') {
        rv.push({ str: prefix, attr });
        attr = init;
        str = str.substr(whole.length);
        continue;
      }
      const entity = tag.toUpperCase();
      if (isEntity(entity)) {
        // XXX Maybe coalesce onto existing string if any
        rv.push({ str: prefix, attr });
        rv.push({ str: Chars[entity], attr });
        str = str.substr(whole.length);
        continue;
      }
    }
    throw new ParseError(`don't know how to parse ${JSON.stringify(str)}`);
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
