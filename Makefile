# build and watch
watch:
	test -e node_modules || npm i
	node build.js watch

# build without watching
build:
	test -e node_modules || npm i
	node build.js

# run local server
serve:
	cd public && python3 -m http.server

# run typechecker
check:
	npx tsc --watch

# run tests
test:
	npm test

deploy:
	git push origin "main:deploy"

count:
	ag -g 'cc$$|hh$$|ts$$|frag$$|vert$$' --ignore='tests' | xargs wc -l

native:
	cd native-layer && npm run build
	node sdl-game/index.js
