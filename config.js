module.exports = {
  TOPIC: 'requests',
  TOPIC_EVENTS: 'finalevents',
  KAFKA_HOST: '127.0.0.1:9092',
  PUBSUB_TOPIC: 'responses',
  MONGO_URL: 'mongodb://localhost:27017/db1',
  MONGO_COLLECTION: 'test',
  ENDPOINT_URL: 'http://127.0.0.1:3000/produce',
  API_PORT: 3000,
  API_CON_TIMEOUT: 5000, // ms
  PRODUCER_CONFIG: {
    requireAcks: 1,
    ackTimeoutMs: 100,
    partitionerType: 4
  }
};
