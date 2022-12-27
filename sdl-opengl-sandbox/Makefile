main: main.cc graphics.o
	g++ main.cc graphics.o -o main -lSDL2 -lGL -lGLU

graphics.o: graphics.cc graphics.hh
	g++ -c graphics.cc -Wno-write-strings
