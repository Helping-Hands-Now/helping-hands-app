var monitoring = require("@google-cloud/monitoring");
var util = require("util");
var functions = require("firebase-functions");
var { ScheduledReporter } = require("metrics");

const projectId = functions.config().gcp.project_id;
// Create to avoid multiple instances of functions from hitting 1 pt/min rate limit
const processId = Math.random(1000);

//A custom reporter that reports all metrics to StackDriver as custom
//metrics to Google Cloud Monitoring at a defined interval.
//Based on https://github.com/mikejihbe/metrics/blob/master/reporting/console-reporter.js
function StackdriverReporter(registry) {
  StackdriverReporter.super_.call(this, registry);
  this.client = new monitoring.MetricServiceClient({
    // Enable retries on DEADLINE_EXCEEDED/UNAVAILABLE
    clientConfig: {
      interfaces: {
        "google.monitoring.v3.MetricService": {
          retry_codes: {
            idempotent: ["DEADLINE_EXCEEDED", "UNAVAILABLE"],
            non_idempotent: ["DEADLINE_EXCEEDED", "UNAVAILABLE"],
          },
        },
      },
    },
  });
}

util.inherits(StackdriverReporter, ScheduledReporter);

StackdriverReporter.prototype.report = function () {
  var metrics = this.getMetrics();
  var self = this;
  var timestamp = Math.floor(Date.now() / 1000);
  var promises = [];

  if (metrics.counters.length !== 0) {
    metrics.counters.forEach(function (count) {
      promises.push(self.reportCounter(count, timestamp));
    });
  }

  if (metrics.meters.length !== 0) {
    metrics.meters.forEach(function (meter) {
      promises.push(self.reportMeter(meter, timestamp));
    });
  }

  if (metrics.histograms.length !== 0) {
    metrics.histograms.forEach(function (histogram) {
      // Don't log histogram if its recorded no metrics.
      if (histogram.min !== null) {
        promises.push(self.reportHistogram(histogram, timestamp));
      }
    });
  }
};

function dataPoint(value, timestamp) {
  return {
    interval: {
      endTime: {
        seconds: timestamp,
      },
    },
    value: value,
  };
}

function resourceTags() {
  // See https://github.com/googleapis/nodejs-logging/blob/master/src/metadata.ts
  const function_name = process.env.K_SERVICE || "unknown";
  // Hardcoded because functions are default run in us-central1.
  // See - https://firebase.google.com/docs/functions/locations
  const region = "us-central1";
  return {
    type: "generic_task",
    labels: {
      project_id: projectId,
      location: region,
      namespace: "cloud_function",
      job: function_name,
      task_id: "",
    },
  };
}

StackdriverReporter.prototype.reportMetric = function (
  metricName,
  metricKind,
  valueType,
  labels,
  dataPoints
) {
  return this.client
    .createTimeSeries({
      name: this.client.projectPath(projectId),
      timeSeries: [
        {
          metric: {
            type: "custom.googleapis.com/" + metricName,
            labels: labels,
          },
          metric_kind: metricKind,
          valueType: valueType,
          // Report metric as firebase function
          resource: resourceTags(),
          points: dataPoints,
        },
      ],
    })
    .catch((e) => {
      console.error("Failed to emit metric: " + metricName, dataPoints, e);
    });
};

StackdriverReporter.prototype.reportCounter = function (counter, timestamp) {
  if (isNumeric(counter.count)) {
    const dp = dataPoint({ int64Value: counter.count }, timestamp);
    return this.reportMetric(counter.name, "GAUGE", "INT64", {}, [dp]).then(
      () => {
        counter.clear(); // reset counter on success
        return;
      }
    );
  }
};

StackdriverReporter.prototype.reportMeter = function (meter, timestamp) {
  const meterMetrics = meter.printObj();
  const reportedMetrics = {
    _count: meterMetrics.count,
    _mean: meterMetrics.mean,
    _one_min_rate: meterMetrics.m1,
    _five_min_rate: meterMetrics.m5,
  };
  let promises = [];
  Object.entries(reportedMetrics).forEach((entry, value) => {
    if (isNumeric(entry[1])) {
      const dp = dataPoint({ doubleValue: entry[1] }, timestamp);
      promises.push(
        this.reportMetric(meter.name + entry[0], "GAUGE", "DOUBLE", {}, [dp])
      );
    }
  });
  return Promise.all(promises);
};

StackdriverReporter.prototype.reportHistogram = function (
  histogram,
  timestamp
) {
  const histogramMetrics = histogram.printObj();
  const reportedMetrics = {
    _min: histogramMetrics.min,
    _max: histogramMetrics.min,
    _count: histogramMetrics.count,
    _p50: histogramMetrics.median,
    _p75: histogramMetrics.p75,
    _p95: histogramMetrics.p95,
    _p99: histogramMetrics.p99,
    _p999: histogramMetrics.p999,
  };
  let promises = [];
  Object.entries(reportedMetrics).forEach((entry, value) => {
    if (isNumeric(entry[1])) {
      const dp = dataPoint({ doubleValue: entry[1] }, timestamp);
      promises.push(
        this.reportMetric(histogram.name + entry[0], "GAUGE", "DOUBLE", {}, [
          dp,
        ])
      );
    }
  });
  return Promise.all(promises);
};

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports = StackdriverReporter;
