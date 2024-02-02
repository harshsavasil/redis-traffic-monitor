const EventEmitter = require('node:events');
const metricEmitter = new EventEmitter();
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { hostname } = require('node:os');
const logger = require('./logger');

const url = 'http://localhost:8086';
const token = 'YpUl8QwkrtPSttB9Eu26j9d2xXhZ1JifZmrcu3okWuwyR0XRN7NCBMDeK9uKMNylqrZW11myxbUK9gO_ERF2eg==';
const org = 'localorg';
const bucket = 'localbucket';

// const url = 'https://influxdb-jkt.pluang.org';
// const token = 'W9NByzMcI17agSTVbpEd';
// const org = 'primary';
// const bucket = 'redis-metrics';

const influxDB = new InfluxDB({ url, token })
let metrics = [];

metricEmitter.on('query', (data) => {
    metrics.push(data);
});

const publishMetrics = () => {
    const writeApi = influxDB.getWriteApi(org, bucket)
    writeApi.useDefaultTags({location: hostname()})
    const dataPoints = [];

    BigInt.prototype.toJSON = function() { return this.toString() }

    metrics.forEach((metric) => {
        const fields = {
            request: JSON.stringify(metric.request),
            startTime: metric.startTime,
            duration_in_ns: metric.duration_in_ns,
            size_in_bytes: metric.size_in_bytes,
        };
        const tags = {
            command: metric.command,
            sender: metric.sender,
        }
        const point = new Point('redis_queries')
            .tag('command', metric.command)
            .tag('sender', metric.sender);
        point.fields = fields;
        
        dataPoints.push(point);
    });

    writeApi.writePoints(dataPoints);
    metrics = [];

    return writeApi.close()
        .then(() => {
            logger.info({ dataPoints }, 'Data points metrics published');
        })
        .catch((err) => {
            logger.error(err, 'Error in influx db write api write points')
        })
};

const interval = 10 * 1000;
const scheduler = setInterval(publishMetrics, interval);

module.exports = metricEmitter;