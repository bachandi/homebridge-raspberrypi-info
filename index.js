var Accessory, Service, Characteristic, UUIDGen, FakeGatoHistoryService;
var inherits = require('util').inherits;
const fs = require('fs');
const packageFile = require("./package.json");
var os = require("os");

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
  return parseInt(entries[2]) / parseInt(entries[1]) * 100.0;
};

function getSwapUsage() {

  const { execSync } = require('child_process');
  // stderr is sent to stderr of parent process
  // you can set options.stdio if you want it to go elsewhere
  let stdout = execSync('free | grep Swap');
  const data = stdout.toString();
  const line = data.substring(0, data.length - 1);
  const entries = line.split(/\s+/);
  const total = parseInt(entries[1]);
  if (total === 0)
    return 0.0;
  return parseInt(entries[2]) /total * 100.0;
};

function getThrottleStatusString() {

  const { execSync } = require('child_process');
  // stderr is sent to stderr of parent process
  // you can set options.stdio if you want it to go elsewhere
  let stdout = execSync('vcgencmd get_throttled');
  const data = stdout.toString();
  const line = data.substring(10, data.length - 1);
  var testNum = parseInt(line);

  // Doc vor vcgenmd: https://elinux.org/RPI_vcgencmd_usage
  // Taken from: https://github.com/raspberrypi/documentation/blob/JamesH65-patch-vcgencmd-vcdbg-docs/raspbian/applications/vcgencmd.md

  if(testNum === 0) return "No throttling";
  outputString = '';
  if((testNum & (1<<0)) > 0) {if(outputString) {outputString += '\n';} outputString += "Under-voltage detected";}
  if((testNum & (1<<1)) > 0) {if(outputString) {outputString += '\n';} outputString += "Arm frequency capped";}
  if((testNum & (1<<2)) > 0) {if(outputString) {outputString += '\n';} outputString += "Currently throttled";}
  if((testNum & (1<<3)) > 0) {if(outputString) {outputString += '\n';} outputString += "Soft temperature limit active";}
  if((testNum & (1<<16)) > 0) {if(outputString) {outputString += '\n';} outputString += "Under-voltage has occurred";}
  if((testNum & (1<<17)) > 0) {if(outputString) {outputString += '\n';} outputString += "Arm frequency capped has occurred";}
  if((testNum & (1<<18)) > 0) {if(outputString) {outputString += '\n';} outputString += "Throttling has occurred";}
  if((testNum & (1<<19)) > 0) {if(outputString) {outputString += '\n';} outputString += "Soft temperature limit has occurred";}
  return outputString
};

function getUptimeString() {

  var data = fs.readFileSync("/proc/uptime", "utf-8");
  return data.split(' ')[0].toFormatedDurationString();
};

function getLoadAvgString(decimalSeperator) {

  var data = fs.readFileSync("/proc/loadavg", "utf-8");
  var splits = data.split(' ');
  return splits[0].split('.').join(decimalSeperator)+' '+splits[1].split('.').join(decimalSeperator)+' '+splits[2].split('.').join(decimalSeperator);
};

function getDiskUsage() {

  const { execSync } = require('child_process');
  // stderr is sent to stderr of parent process
  // you can set options.stdio if you want it to go elsewhere
  let stdout = execSync('df -P / | tail -n 1');
  const data = stdout.toString();
  const line = data.substring(0, data.length - 1);
  const entries = line.split(/\s+/);
  return 100.0 /(1.0+(parseInt(entries[3])/parseInt(entries[2])));
};

function getCustomCommand(commandName) {

  const { execSync } = require('child_process');
  // stderr is sent to stderr of parent process
  // you can set options.stdio if you want it to go elsewhere
  let stdout = execSync(commandName);
  const data = stdout.toString();
  const line = data.substring(0, data.length - 1);
  return line;
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

  this.customCommandName = '';
  this.customCommandTitle = 'Custom';
  if(config["customCommand"]) {
    this.customCommandName = config["customCommand"];
    this.customCommandTitle = config["customCommandTitle"];
  }

  const { execSync } = require('child_process');
  let stdout = execSync('groups');
  const data = stdout.toString();
  this.showThrottleStatus = data.substring(0, data.length - 1).split(' ').includes('video');

	this.setUpServices();
};

RaspberryPiInfo.prototype.getUptime = function (callback) {

  callback(null, getUptimeString());
};

RaspberryPiInfo.prototype.getAvgLoad = function (callback) {

  callback(null, getLoadAvgString(this.strings.DECIMAL_SEPERATOR));
};

RaspberryPiInfo.prototype.getRamUsage = function (callback) {

  callback(null, getRamUsage());
};

RaspberryPiInfo.prototype.getSwapUsage = function (callback) {

  callback(null, getSwapUsage());
};

RaspberryPiInfo.prototype.getThrottleStatus = function (callback) {

  callback(null, getThrottleStatusString());
};

RaspberryPiInfo.prototype.getDiskUsage = function (callback) {

  callback(null, getDiskUsage());
};

RaspberryPiInfo.prototype.customCommand = function (callback) {

  callback(null, getCustomCommand(this.customCommandName));
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
	
  this.fakeGatoHistoryService = new FakeGatoHistoryService("weather", this, { storage: 'fs', disableTimer: !that.useMeanTimer, disableRepeatLastData:true, size: that.historySize });

  this.raspberrypiService = new Service.TemperatureSensor(that.name);

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
  this.raspberrypiService.addOptionalCharacteristic(info);
  this.raspberrypiService.getCharacteristic(info).on('get', this.getUptime.bind(this));

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
  this.raspberrypiService.addOptionalCharacteristic(load);
  this.raspberrypiService.getCharacteristic(load).on('get', this.getAvgLoad.bind(this));

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
  this.raspberrypiService.addOptionalCharacteristic(ramUsage);
  this.raspberrypiService.getCharacteristic(ramUsage).on('get', this.getRamUsage.bind(this));

  let uuid6 = UUIDGen.generate(that.name + '-SwapUsage');
  swapUsage = function () {
    Characteristic.call(this, that.strings.SWAP_USAGE, uuid6);
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
  inherits(swapUsage, Characteristic);
  swapUsage.UUID = uuid6;
  this.raspberrypiService.addOptionalCharacteristic(swapUsage);
  this.raspberrypiService.getCharacteristic(swapUsage).on('get', this.getSwapUsage.bind(this));

  let uuid5 = UUIDGen.generate(that.name + '-DiskUsage');
  diskUsage = function () {
    Characteristic.call(this, that.strings.DISK_USAGE, uuid5);
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
  inherits(diskUsage, Characteristic);
  ramUsage.UUID = uuid5;
  this.raspberrypiService.addOptionalCharacteristic(diskUsage);
  this.raspberrypiService.getCharacteristic(diskUsage).on('get', this.getDiskUsage.bind(this));

  if (that.showThrottleStatus) {
    let uuid4 = UUIDGen.generate(that.name + '-ThrottleStatus');
    throttleStatus = function () {
      Characteristic.call(this, that.strings.THROTTLE_STATUS, uuid4);
      this.setProps({
                    format: Characteristic.Formats.STRING,
                    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
                    });
      this.value = this.getDefaultValue();
    };
    inherits(throttleStatus, Characteristic);
    throttleStatus.UUID = uuid4;
    this.raspberrypiService.addOptionalCharacteristic(throttleStatus);
    this.raspberrypiService.getCharacteristic(throttleStatus).on('get', this.getThrottleStatus.bind(this));
  }

  if (that.customCommandName.length != 0) {
    let uuid7 = UUIDGen.generate(that.name + '-CustomCommand');
    customCommand = function () {
      Characteristic.call(this, that.customCommandTitle, uuid7);
      this.setProps({
                    format: Characteristic.Formats.STRING,
                    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
                    });
      this.value = this.getDefaultValue();
    };
    inherits(customCommand, Characteristic);
    customCommand.UUID = uuid7;
    this.raspberrypiService.addOptionalCharacteristic(customCommand);
    this.raspberrypiService.getCharacteristic(customCommand).on('get', this.customCommand.bind(this));
  }

	var currentTemperatureCharacteristic = this.raspberrypiService.getCharacteristic(Characteristic.CurrentTemperature);

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
