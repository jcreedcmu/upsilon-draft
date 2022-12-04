import { DEBUG } from '../util/debug';
import { Point } from '../util/types';
import { Screen } from './screen';
import { TEXT_PAGE_H } from './ui-constants';
import { TEXT_PAGE_W } from './ui-constants';
import { char_size, COLS, rawPalette, ROWS, SCALE } from './ui-constants';

const screen_size: Point = {
  x: char_size.x * COLS * SCALE,
  y: char_size.y * ROWS * SCALE
}

// returns an array of 16 * 4 floats, which are the rgba values for
// the 16 palette entries.
function paletteData(): number[] {
  function valOfHex(hex: string) {
    return parseInt(hex, 16) / 15;
  }
  const rv: number[] = [];
  for (let i = 0; i < 16; i++) {
    const [r, g, b] = [1, 2, 3].map(pos => valOfHex(rawPalette[i][pos]));
    rv.splice(i * 4, 4, ...[r, g, b, 1.0]);
  }
  return rv;
}

// Make a new framebuffer object bound to a texture. The texture it's
// bound to is the one it *outputs* to when we render.
function makeFb(gl: WebGL2RenderingContext, texture: WebGLTexture): WebGLFramebuffer {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (framebuffer == null)
    throw new Error(`Couldn't create framebuffer`);
  return framebuffer;
}

function shaderProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const prog = gl.createProgram();
  if (prog == null) {
    throw `Couldn't create WebGL program`;
  }
  const addshader = (tp: 'vertex' | 'fragment', source: string) => {
    const s = gl.createShader((tp == 'vertex') ?
      gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
    if (s == null) {
      throw `Couldn't create ${tp} shader`;
    }
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw "Could not compile " + tp +
      " shader:\n\n" + gl.getShaderInfoLog(s);
    }
    gl.attachShader(prog, s);
  };
  addshader('vertex', vs);
  addshader('fragment', fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw "Could not link the shader program!";
  }
  return prog;
}

function attributeSetFloats(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  attr_name: string,
  rsize: number,
  arr: number[]
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr),
    gl.STATIC_DRAW);
  const attr = gl.getAttribLocation(prog, attr_name);
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, rsize, gl.FLOAT, false, 0, 0);
}

type Env = {
  gl: WebGL2RenderingContext,
  progPost: WebGLProgram,
  progText: WebGLProgram,
  fb: WebGLFramebuffer,
}

function getProgPost(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, vert: string, frag: string): WebGLProgram {
  const prog = shaderProgram(gl, vert, frag);
  gl.useProgram(prog);

  attributeSetFloats(gl, prog, "pos", 3, [
    -2, 2, 0,
    2, 2, 0,
    -2, -2, 0,
    2, -2, 0
  ]);

  return prog;
}

function getProgText(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, vert: string, frag: string, font: HTMLImageElement): WebGLProgram {
  const prog = shaderProgram(gl, vert, frag);
  gl.useProgram(prog);

  const canvasSize = gl.getUniformLocation(prog, 'u_canvasSize');
  const fontSampler = gl.getUniformLocation(prog, 'u_fontTexture');
  const textPageSampler = gl.getUniformLocation(prog, 'u_textPageTexture');

  gl.uniform1i(fontSampler, 0);
  gl.uniform1i(textPageSampler, 1);
  gl.uniform2f(canvasSize, canvas.width, canvas.height);

  const palette = gl.getUniformLocation(prog, 'u_palette');
  gl.uniform4fv(palette, paletteData());

  const fontTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fontTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, font);

  const textPageTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, textPageTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  attributeSetFloats(gl, prog, "pos", 3, [
    -2, 2, 0,
    2, 2, 0,
    -2, -2, 0,
    2, -2, 0
  ]);

  return prog;
}

function getEnv(canvas: HTMLCanvasElement, vert: string, fragPost: string, fragText: string, font: HTMLImageElement): Env {
  let gl;
  try {
    gl = canvas.getContext("webgl2");
    if (!gl) { throw "x"; }
  } catch (err) {
    throw "Your web browser does not support WebGL!";
  }
  gl.clearColor(0.8, 0.8, 0.8, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const progText = getProgText(gl, canvas, vert, fragText, font);

  const screenTexture = gl.createTexture();
  if (screenTexture == null) {
    throw new Error(`couldn't create texture`);
  }
  const screenTextureUnit = 3;

  gl.activeTexture(gl.TEXTURE0 + screenTextureUnit);
  gl.bindTexture(gl.TEXTURE_2D, screenTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, screen_size.x, screen_size.y, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const fb = makeFb(gl, screenTexture);

  const progPost = getProgPost(gl, canvas, vert, fragPost);

  // set up screen sampler
  const screenSamplerUniform = gl.getUniformLocation(progPost, 'u_screenTexture');
  if (screenSamplerUniform == null) {
    throw new Error(`couldn't find uniform`);
  }

  gl.uniform1i(screenSamplerUniform, screenTextureUnit);


  return { gl, progPost, progText, fb };
}

async function grab(path: string): Promise<string> {
  return (await fetch(path, { cache: "no-cache" })).text();
}

function getImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const image = new Image();
    image.src = url;
    image.addEventListener('load', () => {
      res(image);
    });
  });
}

export class Pane {
  env: Env;
  start_time_s: number = Date.now() / 1000;
  frame: number = 0;

  draw(screen: Screen) {
    this.frame++;
    if (this.frame % 3 != 0) return;

    if (this.env == null)
      throw 'Uninitialized graphics environment';
    const { gl, progPost, progText, fb } = this.env;

    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const query = gl.createQuery()!;
    const actuallyRender = () => {

      gl.useProgram(progText);

      // XXX maybe do some dirty-checking here
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screen.imdat);

      // Render to framebuffer first
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, screen_size.x, screen_size.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Then apply post-processing effects
      gl.useProgram(progPost);

      const uTime = gl.getUniformLocation(progPost, 'u_time');
      gl.uniform1f(uTime, Date.now() / 1000 - this.start_time_s);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, screen_size.x, screen_size.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    }
    if (DEBUG.glTiming) {
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      for (let i = 0; i < 100; i++) {
        actuallyRender();
      }
      gl.endQuery(ext.TIME_ELAPSED_EXT);

      setTimeout(() => {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        if (available) {
          console.log('elapsed s', gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e9);
        }
        else {
          console.log('not available');
        }
      }, 1000);
    }
    else {
      actuallyRender();
    }
  }

  constructor(vert: string, fragPost: string, fragText: string, font: HTMLImageElement, private c: HTMLCanvasElement) {
    c.width = screen_size.x;
    c.height = screen_size.y;

    this.env = getEnv(c, vert, fragPost, fragText, font);
  }

  canvas(): HTMLCanvasElement {
    return this.c;
  }
}

const scan: { [k: string]: number } = {
  ArrowUp: 128,
  ArrowLeft: 129,
  ArrowDown: 130,
  ArrowRight: 131,
  CapsLock: 17,
  ControlLeft: 17,
  ControlRight: 17,
  ShiftLeft: 16,
  ShiftRight: 16,
  Period: '.'.charCodeAt(0),
  Minus: '-'.charCodeAt(0),
  Space: ' '.charCodeAt(0),
  Comma: ','.charCodeAt(0),
  Slash: '/'.charCodeAt(0),
  Semicolon: ';'.charCodeAt(0),
  BracketLeft: '['.charCodeAt(0),
  BracketRight: ']'.charCodeAt(0),
  Backslash: '\\'.charCodeAt(0),
  Quote: '\''.charCodeAt(0),
  Backquote: '`'.charCodeAt(0),
  Escape: 27,
  Tab: 9,
  Equal: '='.charCodeAt(0),
  Backspace: 8,
  Enter: 10,
}

function getCode(c: string, kc: number): number {
  {
    const m = c.match(/Key(.)/);
    if (m) {
      return m[1].charCodeAt(0);
    }
  }
  {
    const m = c.match(/Digit(.)/);
    if (m) {
      return m[1].charCodeAt(0);
    }
  }
  if (c in scan) return scan[c];

  console.log(c, kc);
  return 1;
}

export async function make_pane(c: HTMLCanvasElement): Promise<Pane> {
  const vert = await grab('./assets/vertex.vert');
  const fragPost = await grab('./assets/fragPost.frag');
  const fragText = await grab('./assets/fragText.frag');
  const font = await getImage('./assets/vga.png');
  const pane = new Pane(vert, fragPost, fragText, font, c);
  return pane;
}
