# Sisu Marine Board

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![ESP32-S3](https://img.shields.io/badge/ESP32--S3-WROOM--2-blue)

A robust, battery-powered ESP32-S3 board designed for real-world 12 V applications — featuring CAN bus, high-current PWM, relay output, power monitoring, and protected I/O.

Perfect for motor control, sensor hubs, marine/RV systems, automotive projects, and industrial IoT.

<img src="images/board-top.png" alt="ESP32-S3 Control Board" width="600"/>

## ✨ Features

- **ESP32-S3-WROOM-2** module with Wi-Fi + Bluetooth 5
- 12 V battery input with robust power filtering and protection
- **CAN bus** interface (ISO 11898-1 compliant)
- **High-current PWM** driver with MOSFET output
- **12 V SPDT Relay** with opto-isolation
- **3× INA226** precision voltage & current monitors (I²C)
- Opto-isolated and ESD-protected digital/sensor inputs
- USB-C for easy programming and serial console
- Reset & Boot buttons, status LEDs, and magnetic buzzer (GPIO2 — use firmware helpers, not a static pin)
- Clearly labeled headers for quick wiring

## 📋 Technical Specifications

See the full details in **[Technical Specs.md](Technical%20Specs.md)**.

Key highlights:

- Dual-core Xtensa LX7 @ up to 240 MHz
- Up to 32 MB Flash + 16 MB PSRAM
- Operating voltage: 9–15 V (12 V nominal)
- Free GPIO breakout headers: JP13 (GPIO13), JP16 (GPIO16), JP18 (GPIO18), JP39 (GPIO39), JP42 (GPIO42)
- Extensive ESD, TVS, and opto-isolation protection

## 📁 Repository Contents

- `hardware/` – Schematics, PCB layout, and Gerber files
- `firmware/` – Example code (Arduino / ESP-IDF)
- `docs/` – Additional documentation
- `images/` – High-resolution board photos and diagrams
- `technical-spec.md` – Detailed technical specification
- `pinout.png` – Visual GPIO and connector reference

## 🚀 Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/esp32-s3-control-board.git
   cd esp32-s3-control-board

   ```

2. **Power the board**
   Connect a 12 V battery to the +12V BAT header, or
   Plug in USB-C (for programming and 3.3 V power)

3. **Flash firmware**
   Hold Boot button → Press and release Reset button
   Use ESP-IDF, Arduino IDE, or ESPTool to flash

4. **Explore examples**
   Basic blink + Wi-Fi
   CAN bus communication
   PWM motor control
   Relay switching
   Battery & voltage monitoring via INA226

5. **📊 Pinout & Connectors**
   <img src="images/safe-gpio-pins.png" alt="Safe GPIO Pins" width="500"/>
   Main Connectors:

Power: +12 V BAT, PWM1, GND
Sensors: SH± (current shunt), LVL1, LVL2
I²C: S_GPIO± (SDA/SCL for INA226 monitors)
CAN: CANH, CANL, GND
Control: ENBL, RPM, TMP1
Relay: NO1, NC1, CO1

Full pin mapping and GPIO usage available in Technical Specs.md. 5. **🛠️ Hardware Protection**

ESD protection on all external I/O
Optocouplers on RPM, Enable, and Relay signals
TVS diodes and common-mode chokes on CAN
Fuse and reverse-polarity protection on 12 V input
Ferrite beads and extensive decoupling

6. **📄 Documentation**

Technical Specs.md – Complete technical reference
Getting Started (coming soon)
Schematics (PDF) in hardware/schematics/

7. **🧩 Supported Frameworks**

ESP-IDF (recommended for maximum performance)
Arduino-ESP32
MicroPython / CircuitPython
PlatformIO

8. **📬 Contributing**
   Contributions, issues, and feature requests are welcome!
   Feel free to open an issue or submit a pull request.

9. **📜 License**
   This project is licensed under the MIT License — see the LICENSE file for details.

10. **❤️ Acknowledgments**

Espressif Systems for the excellent ESP32-S3-WROOM-2 module
Open-source hardware and firmware community

Made for makers who need reliability in the real world.
Questions? Open an issue or reach out on X @SailingSisu.
Happy hacking! ⚡
