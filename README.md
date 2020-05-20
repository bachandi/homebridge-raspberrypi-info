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

Optional config options:
"verboseLogging": false // true or false
"historySize": 4032 // number of maximum history entries
"language": en // set the display language if english is not desired

## Credits

* simont77 - fakegato-history
* YinHangCode - homebridge-raspberrypi-temperature
