var express = require('express');
var bodyParser = require('body-parser');
const Bluebird = require('bluebird');
var shortid = require('shortid');
var kafka = require('kafka-node');
var redisClient = require('redis').createClient();
const {
  TOPIC,
  PRODUCER_CONFIG,
  KAFKA_HOST,
  PUBSUB_TOPIC,
  API_PORT,
  API_CON_TIMEOUT
} = require('./config');
const { getPartition, throwIf, isValidEvent } = require('./utils');

var app = express();
const client = new kafka.KafkaClient({ kafkaHost: KAFKA_HOST });
const producer = new kafka.Producer(client, PRODUCER_CONFIG, getPartition);
const admin = new kafka.Admin(client);

const produceMsg = Bluebird.promisify(producer.send.bind(producer));
const offetGet = Bluebird.promisify(admin.describeGroups.bind(admin));

app.use(bodyParser.json());

const map = {};

function startListener(deps) {
  deps.redis.psubscribe(PUBSUB_TOPIC + ':*');
  deps.redis.on('pmessage', function(pattern, channel, message) {
    const id = channel.split(':')[1];
    if (deps.map[id]) {
      deps.map[id].resolve(JSON.parse(message));
      delete deps.map[id];
    }
    // TODO: flush cache, because maybe some entries may never be deleted
  });
}

function timeout(time) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('REMOTE_CALL_TIMEOUT')), time);
  });
}

function enrichPayloadMaybe(payload) {
  switch (payload.eventId) {
    case 'createJobRequest': {
      return Object.assign({}, payload, { jobRequestId: shortid.generate() });
    }
    default: {
      return payload;
    }
  }
}

function createRemoteCall(requestId) {
    const remoteCall = Bluebird.defer();
    map[requestId] = remoteCall;
    return remoteCall.promise;
}

async function produceRouteHandler(req, res, next) {
  try {
    const payload = req.body;
    const enrichedPayload = enrichPayloadMaybe(payload);
    throwIf(!isValidEvent(enrichedPayload), new Error('EVENT_NOT_VALID'))
    console.log('request -> ', enrichedPayload);
    const remoteCall = createRemoteCall(payload.requestId);
    const [
      kafkaCallResult,
      remoteCallResult,
      offsetResult
    ] = await Bluebird.all([
      produceMsg([
        {
          topic: TOPIC,
          messages: [
            JSON.stringify({
              ...enrichedPayload
            })
          ],
          key: enrichedPayload.jobRequestId
        }
      ]),
      Bluebird.race([remoteCall, timeout(API_CON_TIMEOUT)])
    ]);
    if (remoteCallResult.res === 'FAIL') {
      throw new Error(remoteCallResult.error); // blubble up
    } else {
      res.json({ ok: true, remoteCallResult });
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
}

app.post('/produce', produceRouteHandler);

app.listen(API_PORT, () => {
  console.log('API up');
  startListener({ redis: redisClient, map });
});
