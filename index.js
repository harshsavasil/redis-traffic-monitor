const pcap = require('pcap');
// const RedisProtocol = require('redis-protocol');
const { encode, decode, decodeGen } = require('redis-proto');
// Replace these values with your Redis server configuration
const redisConfig = {
    host: 'localhost',
    port: 6379,
};

const queries = {};
// Create a session to capture network traffic
const pcapSession = pcap.createSession('lo0', { buffer_size: 65536 }); // Use the appropriate network interface

// Set up a Redis protocol parser
// const redisParser = new RedisProtocol();

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
                // console.log(tcpPacket);
                if (tcpPacket.dport === redisConfig.port) {
                    const command = decode(tcpPacket.data);
                    queries[tcpPacket.ackno] = {
                        'command': command,
                        'startTime': process.hrtime(),
                        'duration_in_ns': 0,
                        'size_in_bytes': 0
                    };
                    console.log('Redis Request:', command);
                } else if (tcpPacket.sport === redisConfig.port) {
                    const query = queries[tcpPacket.seqno];
                    if (query) {
                        const response = decode(tcpPacket.data);
                        const duration = process.hrtime(query['startTime']);
                        const duration_in_ns = duration[0] * 1000 * 1000 * 1000 + duration[1];
                        query['duration_in_ns'] = duration_in_ns;
                        query['size_in_bytes'] = Buffer.byteLength(tcpPacket.data);
                        console.log('Redis Response:', query);
                    } else {
                        console.log('Request not found for Response:', decode(tcpPacket.data));
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