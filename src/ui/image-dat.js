class ImageDataPolyfill {
  constructor(width, height) {
    this.data = new Uint8Array(width * height * 4);
  }
}

export const ImageDat = if (typeof window === 'undefined') ? ImageDataPolyfill : ImageData;
