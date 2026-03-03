.PHONY: build
build:
	@echo "Building ts code..."
	rm -rf dist
	pnpm exec tsc --module commonjs

.PHONY: test
test:
	pnpm exec nyc -a \
		--reporter=html \
		--reporter=text mocha './tests' \
		--require esm \
		--require jsdom-global/register \
		--require ts-node/register 'tests/**/*.test.ts' \
		--require tsconfig-paths/register \
		--timeout 300000 \
		--exit
