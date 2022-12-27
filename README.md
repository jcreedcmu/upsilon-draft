upsilon-draft
=============

This is a prototype of a game idea drawing some inspiration from

 - [factorio](https://en.wikipedia.org/wiki/Factorio)
 - [TIS-100](https://en.wikipedia.org/wiki/TIS-100) & other zachtronics games
 - [Orteil's "Nested"](https://orteil.dashnet.org/nested)
 - [Quadrilateral Cowboy](https://en.wikipedia.org/wiki/Quadrilateral_Cowboy)
 - [smalltalk](https://en.wikipedia.org/wiki/Smalltalk)-style reflection
 - [uxn](https://100r.co/site/uxn.html)
 - [Baba is You](https://hempuli.com/baba/)

Thanks to @dwrensha and @tom7 for ideas.

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
| [sdl-opengl-sandbox](sdl-opengl-sandbox) | WIP experiments with SDL/OpenGL bindings |
| [src](src) | Typescript code of the main body of the game |
| [tests](tests) | Unit tests |
