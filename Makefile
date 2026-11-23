.PHONY: setup init dev api web build prototype test test-backend test-frontend test-e2e check extension
PY=.venv/bin/python
setup:
	uv venv --python 3.12 .venv
	uv pip install --python $(PY) -r apps/api/requirements-lock.txt
	npm --prefix apps/web ci --no-audit --no-fund
	@test -e node_modules || ln -s apps/web/node_modules node_modules
init:
	$(PY) -m alembic -c apps/api/alembic.ini upgrade head
	$(PY) scripts/seed_demo.py
check:
	$(PY) scripts/check_env.py
dev:
	$(PY) scripts/dev.py
api:
	$(PY) -m uvicorn studio.main:app --app-dir apps/api --host 127.0.0.1 --port 8010 --reload --reload-dir apps/api
web:
	npm --prefix apps/web run dev
build:
	npm --prefix apps/web run build
prototype: build
	node scripts/build_prototype.mjs
test: test-backend test-frontend test-e2e
test-backend:
	$(PY) -m pytest tests/backend -q
test-frontend:
	npm --prefix apps/web run test -- --config vitest.config.ts
test-e2e:
	node apps/web/node_modules/@playwright/test/cli.js test
extension:
	$(PY) scripts/package_extension.py
