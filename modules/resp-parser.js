const redisProto = require('redis-proto');

class RespParser {
    constructor({ logger }) {
        this.logger = logger;
    }

    decodePacketData(tcpPacket) {
        try {
            const decodedData = redisProto.decode(tcpPacket.data);
            return decodedData;
        } catch (err) {
            this.logger.error({
                err,
                tcpPacketData: tcpPacket.data,
                tcpPacketAckNo: tcpPacket.ackno,
                tcpPacketSeqNo: tcpPacket.seqno
            }, '[respParser] [decodePacketData] Error in decoding the packet');
            return null;
        }
    }
}

module.exports = RespParser;
