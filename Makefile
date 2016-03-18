SRC = api.io-client.js api.io.js
DEPS := deps

all: lint style compile

deps:
	npm set progress=false
	npm install

test: lint style

lint: $(DEPS)
	./node_modules/.bin/jshint --verbose $(SRC)

style: $(DEPS)
	./node_modules/.bin/jscs -e --verbose $(SRC)

compile: $(DEPS)
	mkdir -p browser
	./node_modules/.bin/babel api.io-client.js --plugins transform-es2015-modules-amd --out-file browser/api.io-client.js

.PHONY: all deps lint style compile
