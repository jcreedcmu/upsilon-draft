#version 300 es

precision mediump float;
out vec4 outputColor;
uniform vec2 u_canvasSize;

const int ROWS = 18;
const int COLS = 48;
const int TEXT_PAGE_W = 48;
const int TEXT_PAGE_H = 18;

uniform sampler2D u_fontTexture;

// a TEXT_PAGE_W * ROWS texture. Each pixel has
// - red channel contsin a character code
// - green channel high nybble is bgcolor, low nybble is fgcolor
uniform sampler2D u_textPageTexture;

// Color codes index into this palette:
uniform vec4 u_palette[16];

const int SCALE = 3; // how big a single pixel is
const int FCHAR_W = 32; // how many characters per row in font texture

// How big a glyph is in the font
const ivec2 char_size = ivec2(6, 12);

// Size of the font image
const vec2 im_size = vec2(256.0, 256.0);

// Size of the 'screen'
const vec2 windowSize = vec2(SCALE * COLS * char_size.x, SCALE * ROWS * char_size.y);

// Background color outside of the 'screen'
const vec4 bg = vec4(0.15,0.15,0.1,1.0);


vec2 getPixelPos() {
  return vec2( gl_FragCoord.x, windowSize.y -gl_FragCoord.y); // x ∈ [0.0, COLS * char_size.x * SCALE], y ∈ [0.0, ROWS * char_size.y * SCALE]
}

ivec2 getChar(ivec2 char_pos) {
  vec4 tex = texture(u_textPageTexture,
                     // I think this +0.5 is the most robust way of landing in the middle of the pixel?
                     (vec2(0.5, 0.5) + vec2(char_pos)) / vec2(TEXT_PAGE_W, TEXT_PAGE_H)
                     );
  return ivec2(tex.rg * 255.0);
  //  return u_textPage[char_pos.x + COLS * char_pos.y];
}

vec4 getColor() {
  vec2 pixel_pos = getPixelPos();
  if (pixel_pos.x < 0.0 || pixel_pos.y < 0.0)
	 return bg;
  ivec2 virtual_pixel_pos = ivec2(pixel_pos) / SCALE; // x ∈ [0, COLS * char_size.x], y ∈ [0, ROWS * char_size.y]

  ivec2 char_pos = virtual_pixel_pos / char_size; // x ∈ [0, COLS), y ∈ [0, ROWS)
  ivec2 pixel_within_char = virtual_pixel_pos - char_size * char_pos;
  if (char_pos.x < 0 || char_pos.y < 0 || char_pos.x >= COLS || char_pos.y >= ROWS) {
	 return bg;
  }
  else {

    ivec2 char = getChar(char_pos);

	 int char_code = char.x;
	 int char_attr = char.y;

	 int char_bg = (char_attr & 0xf0) >> 4;
	 int char_fg = char_attr & 0x0f;

	 ivec2 pos_of_char_in_font = ivec2(char_code % FCHAR_W, char_code / FCHAR_W);

	 vec2 im_pos = vec2(pos_of_char_in_font * char_size + pixel_within_char);
	 vec4 tcolor = texture(u_fontTexture, im_pos / im_size);

	 if (tcolor.a < 0.5)
		return u_palette[char_bg];
	 else
		return u_palette[char_fg];
  }
}

const float SHADE_SIZE = 7.0;

float shade_of(float d) {
  return (d < SHADE_SIZE ? d / SHADE_SIZE : 1.0);
}

void main() {
  vec4 color = getColor();
  vec2 pixel_pos = getPixelPos();
  vec2 rel = pixel_pos / windowSize;
  if (rel.x < 0.0 || rel.y < 0.0 || rel.x >= 1.0 || rel.y >= 1.0)
	 outputColor = color;
  else {
	 // float shadex = (1.0 - 4.0 * (rel.x - rel.x * rel.x)) / 3.0;
	 // float shadey = (1.0 - 4.0 * (rel.y - rel.y * rel.y)) / 3.0;
	 // float shade = shadex + shadey;
    float shade =shade_of(pixel_pos.x) * shade_of(pixel_pos.y)
      * shade_of(u_canvasSize.x - pixel_pos.x) * shade_of(u_canvasSize.y - pixel_pos.y);
	 outputColor = vec4((0.3 + 0.7 * shade) * color.rgb, 1.0);
	// outputColor = color;
  }
}
