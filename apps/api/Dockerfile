FROM python:3.12-slim
WORKDIR /app
COPY apps/api/requirements-lock.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY apps/api /app/apps/api
COPY scripts/seed_demo.py /app/scripts/seed_demo.py
RUN useradd --create-home studio && mkdir -p /app/runtime && chown -R studio:studio /app
USER studio
ENV DATA_DIR=/app/runtime
EXPOSE 8000
CMD ["sh","-c","python -m alembic -c apps/api/alembic.ini upgrade head && python scripts/seed_demo.py && python -m uvicorn studio.main:app --app-dir apps/api --host 0.0.0.0 --port 8000"]
