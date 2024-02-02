const pcap = require('pcap');
const redisProto = require('redis-proto');
const metricEmitter = require('./metrics');

// Replace these values with your Redis server configuration
const redisConfig = {
    port: 6379,
};

const queries = {};
// Create a session to capture network traffic
const pcapSession = pcap.createSession('eth0'); // Use the appropriate network interface

console.log('created the pcap session, started listening for packets');

// Listen for network packets
pcapSession.on('packet', (rawPacket) => {
    try {
        const packet = pcap.decode.packet(rawPacket);
        // Check if it's an IP packet
        // if (packet.link_type === 'ETHERNET' && packet.payload.payload.protocol === 'IPv4') {
        const ipv4Packet = packet.payload.payload;
        // console.log(ipv4Packet);
        // Check if it's a TCP packet
        if (ipv4Packet.protocol === 6) {
            const tcpPacket = ipv4Packet.payload;
            // Check if it's a packet sent to or received from the Redis server
            if (
                tcpPacket.data
            ) {
                if (tcpPacket.dport === redisConfig.port) {
                    // console.log(ipv4Packet);
                    const request = redisProto.decode(tcpPacket.data);
                    queries[tcpPacket.ackno] = {
                        'request': request[0].join(' '),
                        'command': request[0][0],
                        'startTime': process.hrtime.bigint(),
                        'duration_in_ns': 0,
                        'size_in_bytes': 0,
                        'sender': ipv4Packet.saddr.toString()
                    };
                } else if (tcpPacket.sport === redisConfig.port) {
                    const query = queries[tcpPacket.seqno];
                    if (query) {
                        const duration_in_ns = process.hrtime.bigint() - query['startTime'];
                        query['duration_in_ns'] = duration_in_ns;
                        query['size_in_bytes'] = Buffer.byteLength(tcpPacket.data);
                        metricEmitter.emit('query', query);
                        delete queries[tcpPacket.seqno];
                    } else {
                        console.log('Request not found for Response:', redisProto.decode(tcpPacket.data));
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing network packet:', error);
    }
});

// Handle errors
pcapSession.on('error', (error) => {
    console.error('Error in pcap session:', error);
});