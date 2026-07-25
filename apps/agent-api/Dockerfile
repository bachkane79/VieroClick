FROM python:3.11-slim

WORKDIR /app

RUN pip install --timeout 120 --retries 5 uv

# Copy the package source before the editable install: hatchling's editable
# build (packages=["app"]) needs app/ to exist, otherwise the install step fails.
COPY pyproject.toml .
COPY app/ ./app/
RUN uv pip install --system --no-cache -e ".[dev]"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
