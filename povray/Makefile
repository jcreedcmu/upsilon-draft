batch:
	povray -D +UA buttons.pov Output_File_Name=button_down_hires.png Declare=PUSH=1
	povray -D +UA buttons.pov Output_File_Name=button_up_hires.png
	convert button_down_hires.png -resize 100x75 ../public/assets/button-down.png
	convert button_up_hires.png -resize 100x75 ../public/assets/button-up.png

draft:
	povray +D +P +UA buttons.pov
good:
	povray +A0.1 +Q11 +D +P +UA buttons.pov
