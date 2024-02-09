const pcap = require('pcap');
const config = require('../config');
const QueryProcessor = require('./query-processor');

class PacketDecoder {
    constructor({ logger }) {
        this.queries = {};
        this.logger = logger;
        this.queryProcessor = new QueryProcessor({ logger: this.logger });
        this.pcapSession = pcap.createSession(config.networkInterface);
        this.requestBuffer = {
            seqno: 0,
            ackno: 0,
            dataLength: 0,
            data: Buffer.from([]),
        };
        this.responseBuffer = {
            seqno: 0,
            ackno: 0,
            dataLength: 0,
            data: Buffer.from([]),
        };
    }

    start() {
        this.pcapSession.on('packet', this.processPacket.bind(this));
        this.pcapSession.on('error', this.handleError.bind(this));
        this.queryProcessor.start();
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
                const { ackno, seqno, dport, sport, data, dataLength } = tcpPacket;
                if (data) {
                    if (dport === config.redisConfig.port) {
                        // request
                        if (seqno === this.requestBuffer.seqno) {
                            // request is part of existing buffer
                            // update seqno, dataLength, and append data
                            // do not update ackno as its linked with initial packet
                            this.requestBuffer = {
                                seqno,
                                ackno: this.requestBuffer.ackno,
                                data: Buffer.concat(this.requestBuffer.data, data),
                                dataLength,
                            };
                        } else {
                            // this is new request
                            if (this.requestBuffer.dataLength) {
                                // emit existing request if valid
                                this.queryProcessor.emit('request', {
                                    // request ackno is mapped with response seqno
                                    key: this.requestBuffer.ackno,
                                    value: this.requestBuffer.data,
                                });    
                            }
                            // update seqno, ackno, dataLength and data
                            this.requestBuffer = {
                                seqno,
                                ackno,
                                data,
                                dataLength,
                            };
                        }
                    } else if (sport === config.redisConfig.port) {
                        // response
                        if (ackno === this.responseBuffer.ackno) {
                            // response is part of existing buffer
                            // update ackno, dataLength and append data
                            // do not update seqno as its linked with initial packet
                            this.responseBuffer = {
                                seqno: this.responseBuffer.seqno,
                                ackno,
                                data: Buffer.concat(this.responseBuffer.data, data),
                                dataLength,
                            }
                        } else {
                            // this is new response
                            if (this.responseBuffer.dataLength) {
                                // emit existing response if valid
                                this.queryProcessor.emit('response', {
                                    // response seqno is mapped with request ackno
                                    key: this.requestBuffer.seqno,
                                    value: this.requestBuffer.data,
                                });
                            }
                            // update seqno, ackno, dataLength and data
                            this.requestBuffer = {
                                seqno,
                                ackno,
                                data,
                                dataLength,
                            };                            
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
