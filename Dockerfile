# Stage 1 — builder
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o here-chat .

# Stage 2 — runner
FROM alpine:latest

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /build/here-chat .

EXPOSE 8080

CMD ["./here-chat", "-addr", ":8080", "-db", "/data/chat.db"]
