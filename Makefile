SRC = $(shell git ls-files \*.js)
DEPS := deps

all: lint style

deps:
	npm set progress=false
	npm install

lint: $(DEPS)
	./node_modules/.bin/jshint --verbose $(SRC)

style: $(DEPS)
	./node_modules/.bin/jscs -e --verbose $(SRC)

.PHONY: all deps lint style
