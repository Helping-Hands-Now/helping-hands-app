var functions = require("firebase-functions"); // Need to initialize this no matter what
var m = require("metrics");

function Metrics() {
  this.report = new m.Report();
  const isEmulator =
    process.env.FUNCTIONS_EMULATOR === true ||
    process.env.FUNCTIONS_EMULATOR === "true";
  this.enabled = functions.config().metrics.enablereporting;
  if (isEmulator) {
    console.log(
      "Detected emulator environment. Instantiating console metrics reporter"
    );
    this.reporter = new m.ConsoleReporter(this.report);
  } else if (this.enabled) {
    console.log("Instantiating StackDriver metrics reporter");
    const StackDriverReporter = require("./stackdriver_reporter.js");
    this.reporter = new StackDriverReporter(this.report);
  } else {
    console.log("Metric reporting is not enabled. Skipping instantiation.");
  }
}

Metrics.prototype.counter = function (counterName) {
  let counter = this.report.getMetric(counterName);
  if (counter === undefined) {
    counter = new m.Counter();
    this.report.addMetric(counterName, counter);
  }
  return counter;
};

Metrics.prototype.histogram = function (histogramName) {
  let histogram = this.report.getMetric(histogramName);
  if (histogram === undefined) {
    histogram = new m.Histogram(null);
    this.report.addMetric(histogramName, histogram);
  }
  return histogram;
};

Metrics.prototype.meter = function (meterName) {
  let meter = this.report.getMetric(meterName);
  if (meter === undefined) {
    meter = new m.Meter();
    this.report.addMetric(meterName, meter);
  }
  return meter;
};

Metrics.prototype.start = function () {
  if (this.enabled) {
    const intervalInMs = 60000; // report every minute
    this.reporter.start(intervalInMs);
  }
};

Metrics.prototype.stop = function () {
  this.reporter.stop();
};

function Singleton() {
  if (!this.instance) {
    this.instance = new Metrics();
    this.instance.start();
  }
}

Singleton.prototype.getInstance = function () {
  console.log("Fetching instantiated Metrics Singleton");
  return this.instance;
};

module.exports = new Singleton().getInstance();
