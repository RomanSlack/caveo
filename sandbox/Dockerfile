# Caveo detonation sandbox: opens one untrusted attachment, reports what it is and what it tried to do.
FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pip install playwright==1.58.0 pymupdf==1.26.* \
 && playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --uid 10001 --create-home sbx
COPY worker.py /opt/caveo/worker.py
USER sbx
WORKDIR /tmp
ENTRYPOINT ["python", "-I", "/opt/caveo/worker.py"]
