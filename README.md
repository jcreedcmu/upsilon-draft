upsilon-draft
=============

Game prototype. See [DESIGN.md](DESIGN.md) for design doc.

Demo
----

[![image](screenshot.png)](https://jcreedcmu.github.io/upsilon-draft/)

Demo available here: https://jcreedcmu.github.io/upsilon-draft/

This is built and deployed by [this github actions workflow](https://github.com/jcreedcmu/upsilon-draft/blob/main/.github/workflows/static.yml).

Development
----------

In one shell, you can
```shell
make watch
```
to build the js bundle and in another
```shell
make serve
```
to start a local server on port 8000.

Browse to http://localhost:8000 to play the game.

Directory Structure
-------------------

| Directory | Description |
| --- | --- |
| [native-layer](native-layer) | A nodejs module providing access to native ui through sdl/opengl     |
| [povray](povray) | POV-Ray files used to generate graphics assets |
| [public](public) | Static assets for browser version |
| [sdl-game](sdl-game) | Entry point for native version |
| [src](src) | Typescript code of the main body of the game |
| [tests](tests) | Unit tests |
