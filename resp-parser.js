const redisProto = require('redis-proto');
const logger = require('./logger');

const decodePacketData = (tcpPacket) => {
    try {
        const decodedData = redisProto.decode(tcpPacket.data);
        return decodedData;
    } catch (err) {
        logger.error({
            err,
            tcpPacketData: tcpPacket.data,
            tcpPacketAckNo: tcpPacket.ackno,
            tcpPacketSeqNo: tcpPacket.seqno
        }, '[respParser] [decodePacketData] Error in decoding the packet');
        return null;
    }
}

module.exports = {
    decodePacketData,
};