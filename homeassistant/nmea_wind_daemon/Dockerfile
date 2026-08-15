# Persistent NMEA wind listener — issue #37. See nmea_wind_daemon.py's
# module docstring for why this exists instead of another command_line poll.
#
# nmea_gateways.py is deliberately NOT copied into this image — it's
# bind-mounted at /app/nmea_gateways.py by docker-compose*.yml so both
# pipelines (this daemon + HA's command_line poller) parse NMEA sentences
# with the exact same code, no drift between the two.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY nmea_wind_daemon.py .

# Heartbeat-file freshness check (see HEARTBEAT_FILE in the script) —
# distinguishes "process alive but wedged" from "process alive and actually
# receiving data" in `docker ps`/`docker compose ps`. 90s = generous margin
# above the default 1Hz publish rate plus reconnect/backoff slack; does not
# by itself trigger a restart (plain `docker compose`, not Swarm) — actual
# restart-safety is the stall watchdog inside the script (STALE_RESTART_SECONDS)
# exiting non-zero, which `restart: unless-stopped` then acts on.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python3 -c "import time,sys,pathlib,os; p=pathlib.Path(os.environ.get('HEARTBEAT_FILE','/tmp/nmea_wind_daemon.heartbeat')); sys.exit(0 if p.exists() and time.time()-float(p.read_text())<90 else 1)"

CMD ["python3", "-u", "nmea_wind_daemon.py"]
