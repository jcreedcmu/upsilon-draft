// some "nominal"/"abstract" types, accomplished by putting
// in some nonce private methods that don't really exist, which are
// named after the class.
export class UniformLoc { private _UniformLoc(): void }
export class ProgramId { private _ProgramId(): void }
export class FramebufferId { private _FramebufferId(): void }
export class TextureId { private _TextureId(): void }

// Main classes

export class NativeLayer {
  constructor(width: number, height: number);
  configShaders(program: ProgramId): void;
  pollEvent(): boolean;
  drawTriangles(): void;
  clear(): void;
  swapWindow(): void;
  finish(): void;
}

export function glUniform1i(uniform: UniformLoc, value: number): void;
export function glUniform1f(uniform: UniformLoc, value: number): void;
export function glUniform2f(uniform: UniformLoc, value: number, value2: number): void;
export function glActiveTexture(textureUnit: number): void;
export function glUniform4fv(uniform: UniformLoc, values: number[]): void;
export function glTexImage2d(width: number, height: number, values: Uint8Array): void;

export class Texture {
  constructor();
  loadFile(filename: string): void;
  textureId(): TextureId;
  bind(textureUnit: number): void;
  makeBlank(width: number, height: number): void;
}

export class Program {
  constructor(vertexShader: string, fragmentShader: string);
  getUniformLocation(name: string): UniformLoc;
  programId(): ProgramId;
  use(): void;
}

export class Framebuffer {
  constructor();
  framebufferId(): FramebufferId;
  bind(): void;
  unbind(): void;
  setOutputTexture(textureId: TextureId): void;
}
