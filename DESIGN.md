# Design Doc

## Elevator Pitch

An automation game where the space in which the player moves around
and interacts is hierarchical, like a filesystem.

## Influences

 - [factorio](https://en.wikipedia.org/wiki/Factorio)
 - [satisfactory](https://www.satisfactorygame.com/)
 - [TIS-100](https://en.wikipedia.org/wiki/TIS-100) & other zachtronics games
 - [Orteil's "Nested"](https://orteil.dashnet.org/nested)
 - [Quadrilateral Cowboy](https://en.wikipedia.org/wiki/Quadrilateral_Cowboy)
 - [smalltalk](https://en.wikipedia.org/wiki/Smalltalk)-style reflection
 - [uxn](https://100r.co/site/uxn.html)
 - [Baba is You](https://hempuli.com/baba/)

Thanks to @dwrensha and @tom7 for ideas.

## Goals

### Narrative Structure

- The standard automation game trope of: at first you do things
  manually and at small scale, and proceeding up to more automation
  and larger scale.

- There should initially be one "computer" the player is operating
  within, and they should eventually gain access to other machines,
  maybe with different "architectures".

### Entities

- The objects in the game world are like files and folders.

- Their properties include a name, some resources that live on them,
  acls.

- Resources feel like quota that can be spent
  constructing things or acting in some way.
  There are perhaps generic ones like:
    - cpu cycles
    - filesystem space
    - ram space
    - network bandwidth
  and maybe more specific ones, like
    - cpu cycles for:
      file type conversion, model training, rendering, (de)compilation
    - filesystem or ram space for:
      text files, graphics files, executables, etc.
    - "privilege points"
    - local vs. internet bandwidth quota

### Player Movement

- There's a notion of current directory, and current selected file.
  Moving up and down directories, and among files within a directory,
  is basic and easy.

- However, it may be obstructed by locked directories or other similar
  mechanisms.

### Engineering Puzzles

- Factorio's mechanics, especially space age, poses some tacit
  engineering puzzles. How do you manage waste on Fulgora and Gleba to
  ensure pipelines don't back up? How do you cope with spoilage on
  Gleba? How do you efficiently arrange Kovarex refinement on Nauvis?
  I'd like to have a similar battery of open-ended problems arise
  naturally without explicit demarcation that a puzzle has started or
  ended.

### UX

- There are real-time elements to gameplay. The primary one is time as a
  cost, as is typical for automation and idle games.

- Universal immediate legibility is not always a goal: I would like to
  push hard on putting concerns like monitoring, alerting into game
  mechanics. This means that portions of the state of game may be
  intentionally opaque until they unlock, design, and/or deploy
  explicit mechanisms to help them understand it.

## Non-Goals

- I have no plans to support multi-player
