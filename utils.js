const events = require('./events');
let Validator = require('fastest-validator');
const v = new Validator();

const hashCode = function(stringOrBuffer) {
  let hash = 0;
  if (stringOrBuffer) {
    const string = stringOrBuffer.toString();
    const length = string.length;

    for (let i = 0; i < length; i++) {
      hash = (hash * 31 + string.charCodeAt(i)) & 0x7fffffff;
    }
  }

  return hash === 0 ? 1 : hash;
};

function getPartition(partitions, key) {
  key = key || '';

  const index = hashCode(key) % partitions.length;
  return partitions[index];
}

function getEventSchema(eventId) {
  const schema = events[eventId];
  if (!schema || !schema.SCHEMA) throw new Error('schema for eventId('+eventId+') not found');
  return schema.SCHEMA;
}

function getEventMockFunc(eventId) {
  const schema = events[eventId];
  if (!schema || !schema.MOCK) throw new Error('mock for eventId('+eventId+') not found');
  return schema.MOCK;
}

function getBusinessRulesOfEvent(eventId) {
  const schema = events[eventId];
  if (!schema) throw new Error('schema for eventId('+eventId+') not found');
  return schema.RULES || [];
}

function isValidEvent(payload) {
  const schema = getEventSchema(payload.eventId);
  return (v.validate(payload, schema) === true)
}

function throwIf(val, error) {
  if (val) throw error;
}

function getEventIds() {
  return Object.keys(events)
}

module.exports = {
  getPartition,
  isValidEvent,
  throwIf,
  getEventIds,
  getEventSchema,
  getEventMockFunc,
  getBusinessRulesOfEvent
};
