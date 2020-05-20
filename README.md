# homebridge-raspberrypi-info

based on YinHang's RaspberryPI temperature plugin and simont77's FakeGatoHistory plugin for homebridge
with more info

<img src=https://raw.githubusercontent.com/thncode/homebridge-raspberrypi-info/master/screenshot.png />

## Configuration
```
"accessories": [{
    "accessory": "RaspberryPiInfo",
    "name": "RaspberryPi Info",
    "updateInterval": 60000,
    "verboseLogging": false,
    "historySize": 4032
}]
```

## Credits

* simont77 - fakegato-history
* YinHangCode - homebridge-raspberrypi-temperature
