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

native-layer/src/gen/palette.h: src/ui/palette.ts src/ui/gen-native-palette.ts
	node build-gen.js
	node gen/gen-native-palette.js

native:
	make native-layer/src/gen/palette.h
	cd native-layer && npm run build
	cd sdl-game && node build.js
	node sdl-game/out/index.js

docker-build: docker/Dockerfile
	docker build . -t dev-env -f docker/Dockerfile

docker-run:
	docker run --rm -it --entrypoint bash  dev-env:latest

docker-x11:
	docker run -v /tmp/.X11-unix:/tmp/.X11-unix -e DISPLAY="$$DISPLAY" -h "$$HOSTNAME" -v "$$HOME"/.Xauthority:/home/x11-user/.Xauthority  dev-env:latest
