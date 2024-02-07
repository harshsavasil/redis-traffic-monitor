const pcap = require('pcap');
const RespParser = require('./resp-parser');
const MetricsEmitter = require('./metrics-emitter');
const config = require('../config');

class PacketDecoder {
    constructor({ logger }) {
        this.queries = {};
        this.logger = logger;
        this.respParser = new RespParser({ logger: this.logger });
        this.metricsEmitter = new MetricsEmitter({ logger: this.logger });
        this.pcapSession = pcap.createSession(config.networkInterface);
    }

    start() {
        this.pcapSession.on('packet', this.processPacket.bind(this));
        this.pcapSession.on('error', this.handleError.bind(this));
        setInterval(this.metricsEmitter.publishMetrics.bind(this.metricsEmitter), 10 * 1000);
        this.logger.info('Started packet decoder');
    }

    processPacket(rawPacket) {
        try {
            const packet = pcap.decode.packet(rawPacket);
            // Check if it's an IP packet
            // if (packet.link_type === 'ETHERNET' && packet.payload.payload.protocol === 'IPv4') {
            const ipv4Packet = packet.payload.payload;
            // Check if it's a TCP packet
            if (ipv4Packet.protocol === 6) {
                const tcpPacket = ipv4Packet.payload;
                // Check if it's a packet sent to or received from the Redis server
                if (
                    tcpPacket.data
                ) {
                    tcpPacket.dport = String(tcpPacket.dport)
                    tcpPacket.sport = String(tcpPacket.sport)
                    tcpPacket.ackno = String(tcpPacket.ackno)
                    tcpPacket.seqno = String(tcpPacket.seqno)
                    if (tcpPacket.dport === config.redisConfig.port) {
                        const request = this.respParser.decodePacketData(tcpPacket);
                        if (!request) {
                            this.queries[tcpPacket.ackno] = null;
                        } else {
                            this.queries[tcpPacket.ackno] = {
                                'request': request[0].join(' '),
                                'command': request[0][0],
                                'startTime': process.hrtime.bigint(),
                                'duration_in_ns': 0,
                                'size_in_bytes': 0,
                                'sender': ipv4Packet.saddr.toString()
                            };
                        }
                    } else if (tcpPacket.sport === config.redisConfig.port) {
                        const query = this.queries[tcpPacket.seqno];
                        if (query === null) {
                            this.logger.info({ tcpPacketData: this.respParser.decodePacketData(tcpPacket), tcpPacketSeqNo: tcpPacket.seqno }, 'Corresponding request not able to get parsed');
                        } else if (query) {
                            const duration_in_ns = process.hrtime.bigint() - query['startTime'];
                            query['duration_in_ns'] = duration_in_ns;
                            query['size_in_bytes'] = Buffer.byteLength(tcpPacket.data);
                            this.metricsEmitter.emit('query', query);
                            delete this.queries[tcpPacket.seqno];
                        } else {
                            this.logger.error({ tcpPacketData: this.respParser.decodePacketData(tcpPacket), tcpPacketSeqNo: tcpPacket.seqno }, 'Corresponding request not found for response');
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error(err, 'Error processing network packet');
        }
    }

    handleError(err) {
        this.logger.error(err, 'Error in pcap session');
    }
}

module.exports = PacketDecoder;
