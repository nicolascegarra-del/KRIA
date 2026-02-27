# AGAMUR Project Makefile
# Usage: make <target>

.PHONY: help up down logs seed migrate shell frontend-install

help:
	@echo "AGAMUR Development Commands:"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - Follow all logs"
	@echo "  make seed        - Seed demo admin user"
	@echo "  make migrate     - Run Django migrations"
	@echo "  make shell       - Django shell"
	@echo "  make frontend    - Install frontend deps"

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

seed:
	docker-compose exec backend python manage.py seed_admin

migrate:
	docker-compose exec backend python manage.py migrate

shell:
	docker-compose exec backend python manage.py shell

frontend-install:
	cd frontend && npm install

# Production
prod-up:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Database
db-dump:
	docker-compose exec db pg_dump -U agamur agamur > backup_$(shell date +%Y%m%d).sql

rls-apply:
	docker-compose exec db psql -U agamur agamur < backend/scripts/rls_policies.sql
