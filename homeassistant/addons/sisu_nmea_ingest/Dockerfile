# Local Supervisor add-on — kernel NMEA ingest (#57).
# nmea_gateways.py is mapped from /homeassistant at runtime (run.py).
# nmea_wind_daemon.py is copied into this folder by ha-kernel-mqtt.sh
# before Supervisor builds (do not fork the daemon here).
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY nmea_wind_daemon.py run.py ./

LABEL \
  io.hass.name="Sisu NMEA ingest" \
  io.hass.description="YDWG+DataHub kernel ingest → sisu/v1" \
  io.hass.version="1.0.0" \
  io.hass.type="addon" \
  io.hass.arch="aarch64|amd64"

CMD ["python3", "-u", "/app/run.py"]
