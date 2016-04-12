SRC = api.io-client.js api.io.js
DEPS := deps

all: test lint style compile

tests: test lint style

deps:
	npm set progress=false
	npm install

test: $(DEPS)
	./node_modules/.bin/mocha --reporter spec --ui tdd --recursive test

lint: $(DEPS)
	./node_modules/.bin/jshint --verbose $(SRC)

style: $(DEPS)
	./node_modules/.bin/jscs -e --verbose $(SRC)

compile: $(DEPS)
	mkdir -p browser
	./node_modules/.bin/babel api.io-client.js --plugins transform-es2015-modules-amd --out-file browser/api.io-client.js
	./node_modules/.bin/babel ./node_modules/co/index.js --plugins transform-es2015-modules-amd --out-file browser/co.js

.PHONY: all deps test lint style compile
