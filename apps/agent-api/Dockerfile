FROM python:3.11-slim

WORKDIR /app

RUN pip install --timeout 120 --retries 5 uv

COPY pyproject.toml .
RUN uv pip install --system --no-cache -e ".[dev]"

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
