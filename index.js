var Accessory, Service, Characteristic, UUIDGen, FakeGatoHistoryService;
var inherits = require('util').inherits;
const fs = require('fs');
const packageFile = require("./package.json");
var os = require("os");
var decimal_seperator;

module.exports = function(homebridge) {

    if(!isConfig(homebridge.user.configPath(), "accessories", "RaspberryPiInfo")) {
        return;
    }
    
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory('homebridge-raspberrypi-info', 'RaspberryPiInfo', RaspberryPiInfo);
}

String.prototype.toFormatedDurationString = function () {

  var sec_num = parseInt(this, 10);
  var days = Math.floor(sec_num / 86400);
  sec_num = sec_num - (days * 86400);
  var hours = Math.floor(sec_num / 3600);
  sec_num = sec_num - (hours * 3600);
  var minutes = Math.floor(sec_num / 60);
  sec_num = sec_num - (minutes * 60);
  var seconds = sec_num;
  var outputString = '';
  if (days > 0)
    outputString += days + 'd';
  if (hours > 0 || days > 0)
    outputString += ' '+ hours + 'h';
  if (minutes > 0 || hours > 0 || days > 0)
    outputString += ' '+ minutes + 'm';
  if (days === 0)
    outputString += ' '+ seconds + 's';
  return outputString;
}

function getRamUsage() {

  const { execSync } = require('child_process');
  // stderr is sent to stderr of parent process
  // you can set options.stdio if you want it to go elsewhere
  let stdout = execSync('free | grep Mem');
  const data = stdout.toString();
  const line = data.substring(0, data.length - 1);
  const entries = line.split(/\s+/);
  return parseFloat(entries[2]) / parseFloat(entries[1]) * 100.0;
};

function getUptimeString() {

  var data = fs.readFileSync("/proc/uptime", "utf-8");
  return data.split(' ')[0].toFormatedDurationString();
};

function getLoadAvgString() {

  var data = fs.readFileSync("/proc/loadavg", "utf-8");
  var splits = data.split(' ');
  return splits[0].split('.').join(decimal_seperator)+' '+splits[1].split('.').join(decimal_seperator)+' '+splits[2].split('.').join(decimal_seperator);
};

function getModel() {

  const { execSync } = require('child_process');
  // stderr is sent to stderr of parent process
  // you can set options.stdio if you want it to go elsewhere
  let stdout = execSync('cat /sys/firmware/devicetree/base/model');
  const data = stdout.toString();
	return data.substring(0, data.length - 1);
};

function isConfig(configFile, type, name) {
    var config = JSON.parse(fs.readFileSync(configFile));
    if("accessories" === type) {
        var accessories = config.accessories;
        for(var i in accessories) {
            if(accessories[i]['accessory'] === name) {
                return true;
            }
        }
    } else if("platforms" === type) {
        var platforms = config.platforms;
        for(var i in platforms) {
            if(platforms[i]['platform'] === name) {
                return true;
            }
        }
    } else {
    }
    
    return false;
};

function RaspberryPiInfo(log, config) {
    if(null == config) {
        return;
    }

    this.log = log;

    var language = 'en';
    if(config.language != undefined) {
      language = config.language;
    }
    this.strings = require('./lang/' + language + '.json').strings;
    decimal_seperator = this.strings.DECIMAL_SEPERATOR;

    this.name = config["name"];
    if(config["file"]) {
        this.temperatureFile = config["file"];
    } else {
        this.temperatureFile = "/sys/class/thermal/thermal_zone0/temp";
    }
    if(config["updateInterval"] && config["updateInterval"] > 0) {
        this.updateInterval = config["updateInterval"];
    } else {
        this.updateInterval = null;
    }
    this.verboseLogging = false;
    if(config["verboseLogging"]) {
      this.verboseLogging = true;
    }
    this.historySize = 4032;
    if(config["historySize"] && config["historySize"] > 0) {
      this.historySize = config["historySize"];
    }
    this.useMeanTimer = false;
    if(config["useMeanTimer"]) {
      this.useMeanTimer = true;
    }
  
	this.setUpServices();
};

RaspberryPiInfo.prototype.getUptime = function (callback) {

  callback(null, getUptimeString());
};

RaspberryPiInfo.prototype.getAvgLoad = function (callback) {

  callback(null, getLoadAvgString());
};

RaspberryPiInfo.prototype.getRamUsage = function (callback) {

  const ramUsageVal = getRamUsage();
  callback(null, ramUsageVal);
};

RaspberryPiInfo.prototype.setUpServices = function () {

	var that = this;
	var temperatureValue;
	
	this.infoService = new Service.AccessoryInformation();
	this.infoService
		.setCharacteristic(Characteristic.Manufacturer, "Raspberry Pi Foundation")
		.setCharacteristic(Characteristic.Model, getModel())
		.setCharacteristic(Characteristic.SerialNumber, os.hostname()) // Note that if your Eve.app is controlling more than one accessory for each type, the serial number should be unique, otherwise Eve.app will merge the histories.
		.setCharacteristic(Characteristic.FirmwareRevision, packageFile.version);
	
  this.fakeGatoHistoryService = new FakeGatoHistoryService("weather", this, { storage: 'fs', disableTimer: !that.useMeanTimer, size: that.historySize });
	
	let uuid1 = UUIDGen.generate(that.name + '-Uptime');
	info = function (displayName, subtype) {
		Characteristic.call(this, that.strings.UPTIME, uuid1);
		this.setProps({
			format: Characteristic.Formats.STRING,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(info, Characteristic);
	info.UUID = uuid1;

	let uuid2 = UUIDGen.generate(that.name + '-AvgLoad');
	load = function () {
		Characteristic.call(this, that.strings.LOAD_AVERAGE, uuid2);
		this.setProps({
			format: Characteristic.Formats.STRING,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(load, Characteristic);
	load.UUID = uuid2;

  let uuid3 = UUIDGen.generate(that.name + '-RamUsage');
  ramUsage = function () {
    Characteristic.call(this, that.strings.RAM_USAGE, uuid3);
    this.setProps({
                  format: Characteristic.Formats.FLOAT,
                  unit: Characteristic.Units.PERCENTAGE,
                  maxValue: 100,
                  minValue: 0,
                  minStep: 0.1,
                  perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
                  });
    this.value = this.getDefaultValue();
  };
  inherits(ramUsage, Characteristic);
  ramUsage.UUID = uuid3;

	this.raspberrypiService = new Service.TemperatureSensor(that.name);

  this.raspberrypiService.addOptionalCharacteristic(info);
  this.raspberrypiService.addOptionalCharacteristic(load);
  this.raspberrypiService.addOptionalCharacteristic(ramUsage);

	var currentTemperatureCharacteristic = this.raspberrypiService.getCharacteristic(Characteristic.CurrentTemperature);

	this.raspberrypiService.getCharacteristic(info).on('get', this.getUptime.bind(this));
	this.raspberrypiService.getCharacteristic(load).on('get', this.getAvgLoad.bind(this));
  this.raspberrypiService.getCharacteristic(ramUsage).on('get', this.getRamUsage.bind(this));
	
	function getCurrentTemperature() {
		const data = fs.readFileSync(that.temperatureFile, "utf-8");
		temperatureValue = parseFloat(data) / 1000;
    return temperatureValue;
  }

	currentTemperatureCharacteristic.updateValue(getCurrentTemperature());
  if(that.updateInterval) {
		setInterval(() => {
			currentTemperatureCharacteristic.updateValue(getCurrentTemperature());

      if (that.verboseLogging) {
			  that.log("Raspberry Temperature: " + temp);
      }
			this.fakeGatoHistoryService.addEntry({time: new Date().getTime() / 1000, temp: temperatureValue});
		}, that.updateInterval);
	}
	
	currentTemperatureCharacteristic.on('get', (callback) => {
		callback(null, getCurrentTemperature());
	});
}

RaspberryPiInfo.prototype.getServices = function () {

	return [this.infoService, this.fakeGatoHistoryService, this.raspberrypiService];
};
