# Build Spring Boot + ship with Python parser (Render builds this in the cloud).
# No local Docker required on your laptop.

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY backend/pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline || true
COPY backend/src ./src
RUN mvn -B -DskipTests package \
  && mv target/core-0.0.1-SNAPSHOT.jar /build/app.jar

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /build/app.jar /app/app.jar
COPY backend/parser /app/parser
RUN python3 -m venv /app/parser/.venv \
  && /app/parser/.venv/bin/pip install --no-cache-dir -r /app/parser/requirements.txt

COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENV PORT=8090 \
    PARSER_PORT=8001 \
    CODESYMPHONY_PARSER_BASE_URL=http://127.0.0.1:8001 \
    CODESYMPHONY_CORS_ALLOWED_ORIGINS=http://localhost:5173 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"

EXPOSE 8090
CMD ["/app/start.sh"]
