var kafka = require('kafka-node');
const streamToObservable = require('stream-to-observable');
const Rx = require('rxjs/Rx');
const async = require('async');
const Bluebird = require('bluebird');
const {
  KAFKA_HOST,
  TOPIC,
  PRODUCER_CONFIG,
  TOPIC_EVENTS,
  PUBSUB_TOPIC,
  MONGO_URL,
  MONGO_COLLECTION
} = require('./config');
const { getPartition, getBusinessRulesOfEvent } = require('./utils');
const client = new kafka.Client();
const consumerGroup = new kafka.ConsumerGroupStream(
  {
    kafkaHost: KAFKA_HOST,
    groupId: 'ExampleTestGroup',
    sessionTimeout: 15000,
    protocol: ['roundrobin'],
    fromOffset: 'latest',
    asyncPush: false,
    autoCommit: false
  },
  TOPIC
);
const producer = new kafka.Producer(client, PRODUCER_CONFIG, getPartition);
var redisClient = require('redis').createClient();
const _ = require('lodash');

var MongoClient = require('mongodb').MongoClient;

class Response {
  static Pass(doc) {
    return new Response({ res: 'PASS', doc });
  }
  static Success(doc) {
    return new Response({ res: 'SUCCESS', doc });
  }
  static Fail(doc, error) {
    return new Response({ res: 'FAIL', doc, error });
  }
  constructor(obj) {
    this.res = obj.res;
    this.error = obj.error;
    this.doc = obj.doc;
  }
}
Response.errors = {
  PROCESSING_ERROR: 'PROCESSING_ERROR'
};

const reducer = (state, key) => () => {
  state[key] = state[key] + 1;
};

const process = deps => async message => {
  const json = JSON.parse(message.value);
  debug('process')(message);
  try {
    await Bluebird.promisify(
      async.retryable(
        {
          times: 3,
          interval: function(retryCount) {
            return 50 * Math.pow(2, retryCount);
          }
        },
        processTask
      )
    ).bind(async)(deps, message, json);
  } catch (e) {
    console.log(e);
    await deps.pubsub(
      PUBSUB_TOPIC + ':' + json.requestId,
      JSON.stringify(Response.Fail(message, Response.errors.PROCESSING_ERROR))
    );
    // maybe commit to fail topic
    await deps.commit(message, true); // commit offset
  }
  return message;
};

function mustBeResponse(input) {
  if (!input instanceof Response) {
    throw new Error('runAction must return ResponseClass');
  }
}

async function processTask(deps, message, payload) {
  debug('run')(message);
  const res = await runAction(deps, message, payload);
  mustBeResponse(res);
  await deps.producer([
    {
      topic: TOPIC_EVENTS,
      messages: [message.value],
      key: message.key
    }
  ]); // forward message to final event store
  await deps.pubsub(
    PUBSUB_TOPIC + ':' + payload.requestId,
    JSON.stringify(res)
  );
  await deps.commit(message, true); // commit offset
  return message;
}

const debug = part => msg => {
  console.log(part + ' -> ' + new Date(), JSON.parse(msg.value).requestId);
};

const pauseOrResume = (state, stream) => () => {
  if (state.in - state.out > 20 && !stream.isPaused()) {
    console.log('pause');
    stream.pause();
  }
  if (state.in - state.out <= 20 && stream.isPaused()) {
    console.log('unpause');
    stream.resume();
  }
};

const connectMongo = function(cb) {
  MongoClient.connect(MONGO_URL, (err, client) => {
    if (err) return console.log(err);
    cb(client.db().collection(MONGO_COLLECTION));
  });
};

async function duplicationCheck(deps, payload) {
  return await deps.mongo.findOne({
    array: { $in: [payload.requestId] }
  });
}

async function loadAggregate(deps, payload) {
  return await deps.mongo.findOne({
    jobRequestId: payload.jobRequestId
  });
  // could validate aggregate here
}

// TODO: add write concerns
async function updateAggregate(deps, payload, agg) {
  // could validate aggregate here
  const res = await deps.mongo.findOneAndUpdate(
    {
      jobRequestId: payload.jobRequestId
    },
    { $set: agg },
    { new: true }
  );
  if (res.ok !== 1) throw new Error('mongo error');
  return res.value;
}

// TODO: add write concerns
async function createAggregate(deps, payload, agg) {
  return await deps.mongo.insert(agg);
}

function reduceBr(array) {
  return (deps, payload, agg) => {
    _.each(array, f => f(payload, agg));
  };
}

async function createHandler(deps, payload, message) {
  const dup = await duplicationCheck(deps, payload);
  if (dup) return Response.Pass(dup);
  const [err] = runBusinessLogic(deps, payload, {});
  if (err) return Response.Fail(message, err);
  const newAgg = aggregateReducer(payload, {});
  await createAggregate(deps, payload, newAgg);
  return Response.Success(newAgg);
}

async function defaultHandler(deps, payload, message) {
  const dup = await duplicationCheck(deps, payload);
  if (dup) return Response.Pass(dup);
  const agg = await loadAggregate(deps, payload);
  const [err] = runBusinessLogic(deps, payload, agg);
  if (err) return Response.Fail(message, err);
  const newAgg = aggregateReducer(payload, agg);
  await updateAggregate(deps, payload, newAgg);
  return Response.Success(newAgg);
}

const eventActions = {
  createJobRequest: createHandler,
  accepteJobRequest: defaultHandler,
  declineJobRequest: defaultHandler
};

function aggregateReducer(payload, agg) {
  switch (payload.eventId) {
    case 'accepteJobRequest': {
      return {
        ...agg,
        acceptedCleaner: payload.cleanerId,
        answers: { ...agg.answers, [payload.cleanerId]: 'accepted' }
      };
    }
    case 'createJobRequest': {
      return {
        cleaners: payload.cleaners,
        tasks: payload.tasks,
        jobRequestId: payload.jobRequestId,
        answers: {}
      };
    }
    default: {
      return agg;
    }
  }
}

function runBusinessLogic(deps, payload, agg) {
  const rules = deps.getBusinessRulesOfEvent(payload.eventId);
  try {
    reduceBr(rules)(deps, payload, agg);
    return [];
  } catch (e) {
    return [e.message];
  }
}

function resolveHandler(sources = {}) {
  return (source, id) => {
    const resolvedAction = sources[source][id];
    if (!resolvedAction)
      throw new Error(
        'handler not found for id:' + id + ' in source:' + source
      );
    return resolvedAction;
  };
}

// execute command
async function runAction(deps, message, payload) {
  const resolvedAction = deps.getHandler('eventActions', payload.eventId);
  return await resolvedAction(deps, payload, message);
}

const flow = deps =>
  streamToObservable(deps.stream)
    .do(debug('in'))
    .do(reducer(state, 'in'))
    .do(pauseOrResume(state, consumerGroup))
    .flatMap(process(deps), null, 1) // concurrency 1
    .do(reducer(state, 'out'))
    .do(pauseOrResume(state, consumerGroup))
    .do(debug('out'));

const state = { in: 0, out: 0 };

connectMongo(mongo => {
  console.log('mongo connected');
  client.once('ready', () => {
    console.log('kafka ready');
    flow({
      pubsub: Bluebird.promisify(redisClient.publish).bind(redisClient),
      commit: Bluebird.promisify(consumerGroup.commit.bind(consumerGroup)),
      producer: Bluebird.promisify(producer.send.bind(producer)),
      mongo,
      stream: consumerGroup,
      getBusinessRulesOfEvent,
      getHandler: resolveHandler({
        eventActions
      })
    }).subscribe(_.noop);
  });
});
