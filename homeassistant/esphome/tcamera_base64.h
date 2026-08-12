// Minimal, self-contained base64 encoder for tcamera.yaml's audio-chunk
// upload (issue #33) -- written inline rather than relying on mbedtls's
// base64 header being reliably includable from an ESPHome lambda context.
// Standard algorithm, no external dependencies beyond <string>/<cstdint>.
#pragma once
#include <string>
#include <cstdint>
#include <cstddef>

inline std::string tcamera_base64_encode(const uint8_t *data, size_t len) {
  static const char *chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve(((len + 2) / 3) * 4);
  size_t i = 0;
  while (i + 3 <= len) {
    uint32_t n = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    out += chars[(n >> 18) & 0x3F];
    out += chars[(n >> 12) & 0x3F];
    out += chars[(n >> 6) & 0x3F];
    out += chars[n & 0x3F];
    i += 3;
  }
  size_t rem = len - i;
  if (rem == 1) {
    uint32_t n = data[i] << 16;
    out += chars[(n >> 18) & 0x3F];
    out += chars[(n >> 12) & 0x3F];
    out += "==";
  } else if (rem == 2) {
    uint32_t n = (data[i] << 16) | (data[i + 1] << 8);
    out += chars[(n >> 18) & 0x3F];
    out += chars[(n >> 12) & 0x3F];
    out += chars[(n >> 6) & 0x3F];
    out += "=";
  }
  return out;
}
