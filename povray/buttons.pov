#version 3.7;
// assumed_gamma 1.0;
#include "colors.inc"    // The include files contain

#declare bigRad = 1;
#declare smallRad = 0.8;
#declare medRad = 0.83;

#declare bigRad2 = 0.3;
#declare smallRad2 = smallRad * bigRad2 / bigRad;
#declare coneDepth = 1;
#declare sphereFlatten = 0.3;
#declare sphereFlatten2 = 0.6;

#declare xoff = -1.5;

#declare buttonVerticalDisplace = -0.3;

#declare myCone = cone {
  <0,0.01,0>, bigRad
  <0,-coneDepth,0>, 0
};

#declare myCone2 = cone {
  <0,0.01,0>, bigRad2
  <0,-coneDepth,0>, 0
  translate <xoff, 0, 0>
};

#if (false)
  camera {
    location <1, 2, -5>
    look_at  <0, 0,  0>
  }
#else
  camera {
    location <0, 5, -0.01>
    look_at  <0, 0,  0>
  }

#end

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
    plane {  <0, 1, 0>, 0 }
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
  sphere {  <xoff, 0, 0>, smallRad2 scale <1, sphereFlatten2, 1> }


};

union {
  formm
  texture {
    pigment { color  rgb <1.0, 0.8, 0.8> }
  }
}

light_source { <-2, 4, 3> color rgb <1,0.9,0.8>}
light_source { <1, 4, -3> color rgb <1,1.1,1.2>}
