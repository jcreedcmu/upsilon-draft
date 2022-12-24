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
	ag -g 'ts$$|frag$$|vert$$' --ignore='source/test/*.ts' | xargs wc -l
