#version 3.7;
#include "colors.inc"    // The include files contain

global_settings {
  assumed_gamma 1.0
  radiosity {
     pretrace_start 0.08
      pretrace_end   0.01
      count 150
      nearest_count 10
      error_bound 0.5
      recursion_limit 3
      low_error_factor 0.5
      gray_threshold 0.0
      minimum_reuse 0.005
      maximum_reuse 0.2
      brightness 1
      adc_bailout 0.005
  }
}
default {finish {ambient 0}}
#declare bigRad = 1;
#declare smallRad = 0.8;
#declare medRad = 0.83;

#declare bigRad2 = 0.3;
#declare smallRad2 = smallRad * bigRad2 / bigRad;
#declare coneDepth = 1;
#declare sphereFlatten = 0.3;
#declare sphereFlatten2 = 0.6;

#declare xoff = -1.5;

#ifdef (PUSH)
#declare pushed = true;
#else
#declare pushed = false;
#end

#if (pushed)
#declare buttonVerticalDisplace = -0.3;
#else
#declare buttonVerticalDisplace = -0.1;
#end

#declare myCone = cone {
  <0,0.01,0>, bigRad
  <0,-coneDepth,0>, 0
};

#declare myCone2 = cone {
  <0,0.01,0>, bigRad2
  <0,-bigRad2,0>, 0
  translate <xoff, 0, 0>
};

#if (false)
  camera {
    location <1, 2, -5>
    look_at  <0, 0,  0>
  }
#else
  camera {
    location <0, 3, -0.01>
    look_at  <0, 0,  0>
  }

#end

background { colour srgbt <0.0, 0.0, 0.0, 1.0> }

#declare pillHeight = 0.3;
#declare pillRad = 0.06;
#declare pill = union {
  sphere {<0,0,pillHeight>, pillRad}
  sphere {<0,0,-pillHeight>, pillRad}
  cylinder {<0,0,pillHeight>, <0,0,-pillHeight>, pillRad}
  translate <0, 0.85 * sphereFlatten, 0>
};
#declare formm = union {
  difference {
    plane {  <0, 1, 0>, 0         texture {pigment {color srgbt<0,0,0,1>} } }
    myCone
    cylinder {<0,0.01,0>, <0,-10,0>, medRad }
    myCone2
  }

  union {
  difference {
    sphere {  <0, 0, 0>, smallRad scale <1, sphereFlatten, 1>}
    torus { bigRad * 0.55, bigRad * 0.09 translate <0, sphereFlatten * 0.80, 0>}
    pill
  }
    cylinder { <0,0,0>, <0,-2,0>, smallRad }
    translate <0, buttonVerticalDisplace, 0>
  }
  sphere {  <xoff, 0, 0>, smallRad2 scale <1, sphereFlatten2, 1>
    #if (pushed)
  texture {finish {emission rgb<0,1,1>} pigment {color White}}
    #else
        texture {pigment {color rgb<0.2,0.15,0.1>} }
    #end
  }


};

union {
  formm
  texture {
    pigment { color  rgb <1.0, 0.8, 0.6> }
  }
}

//sphere {<0,0,0>, 1000 texture {finish{emission 0.1} pigment{color White}}}
light_source { <-2, 4, 3> color rgb <0.5,0.5,0.5>}
// light_source { <1, 4, -3> color rgb <1,1.1,1.2>}
