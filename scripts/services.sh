#!/usr/bin/env bash
# Start all Cortex Python microservices in the background

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

start_service() {
    local name="$1"
    local port="$2"
    local dir="$ROOT/services/$name"

    echo "Starting $name service on port $port..."
    pushd "$dir" > /dev/null
    .venv/bin/python main.py &
    echo $! > "/tmp/cortex-$name.pid"
    popd > /dev/null
    echo "  ✓ $name started (PID: $(cat /tmp/cortex-$name.pid))"
}

stop_services() {
    echo "Stopping Cortex services..."
    for svc in embeddings whisper rag; do
        local pid_file="/tmp/cortex-$svc.pid"
        if [[ -f "$pid_file" ]]; then
            local pid
            pid=$(cat "$pid_file")
            kill "$pid" 2>/dev/null && echo "  ✓ $svc stopped" || echo "  ! $svc was not running"
            rm -f "$pid_file"
        fi
    done
}

case "${1:-start}" in
    start)
        start_service embeddings 8001
        start_service whisper    8002
        start_service rag        8003
        echo ""
        echo "All services running. Use 'bash scripts/services.sh stop' to stop."
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 1
        start_service embeddings 8001
        start_service whisper    8002
        start_service rag        8003
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac
