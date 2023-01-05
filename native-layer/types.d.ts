// some "nominal"/"abstract" types, accomplished by putting
// in some nonce private methods that don't really exist, which are
// named after the class.
export class UniformLoc { private _UniformLoc(): void }
export class ProgramId { private _ProgramId(): void }

// Main classes

export class NativeLayer {
  configShaders(program: ProgramId): void;
  pollEvent(): boolean;
  renderFrame(): void;
  swapWindow(): void;
  finish(): void;
}

export function glUniform1i(uniform: UniformLoc, value: number): void;
export function glUniform2f(uniform: UniformLoc, value: number, value2: number): void;

export class Texture {
  constructor();
  loadFile(filename: string): void;
  bind(textureUnit: number): void;
}

export class Program {
  constructor(vertexShader: string, fragmentShader: string);
  getUniformLocation(name: string): UniformLoc;
  programId(): ProgramId;
  use(): void;
}
