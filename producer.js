const Rx = require('rxjs/Rx');
const inquirer = require('inquirer');
const Bluebird = require('bluebird');
let Validator = require('fastest-validator');
const request = require('request');
var shortid = require('shortid');
const v = new Validator();

const events = require('./events');
const mockData = require('./mockdata');
const { ENDPOINT_URL } = require('./config');

const askSendRequest = {
  name: 'request',
  type: 'expand',
  message: 'Send Request',
  choices: [
    { key: 'y', name: 'Yes', value: 'yes' },
    { key: 'n', name: 'No', value: 'no' }
  ]
};

const askWhichEvent = {
  name: 'eventId',
  type: 'list',
  message: 'EventId',
  choices: Object.keys(events)
};

var prompts = new Rx.Subject();

function reducer(state = {}) {
  return action => {
    state[action.name] = action.answer;
  };
}

function mapEventIdToData(eventId) {
  const questions = [];
  const eventResolved = events[eventId];
  if (!eventResolved) throw new Error('event not found');
  Object.keys(eventResolved).forEach(key => {
    const val = eventResolved[key];
    if (val.type === 'string') {
      questions.push({
        name: key,
        type: 'input',
        message: 'Value for ' + key
      });
    }
  });
  return { questions, schema: eventResolved };
}

function mapEventIdToMockData(eventId, state) {
  const resolvedMockDataFunc = mockData[eventId];
  if (!resolvedMockDataFunc) throw new Error('mock data not found');
  return resolvedMockDataFunc(state);
}

function validate(state, cb, cbFail) {
  const { schema } = mapEventIdToData(state.eventId);
  const payload = mapEventIdToMockData(state.eventId, state);
  if (v.validate(payload, schema) === true) {
    cb(payload);
  } else {
    cbFail && cbFail();
  }
}

function flushState(state) {
  Object.keys(state).forEach(key => {
    delete state[key];
  });
}

function sendRequest(payload, endpoint, ui, requestId, cb) {
  var options = {
    method: 'post',
    body: Object.assign({}, payload, { requestId }),
    json: true,
    url: endpoint
  };
  let bar = '.';
  const inter = setInterval(() => {
    bar += '.';
    ui.updateBottomBar(bar);
  }, 100);
  request(options, function(err, res, body) {
    clearInterval(inter);
    if (err) {
      console.error('error posting json: ', err);
      cb();
    }
    console.log(JSON.stringify(body, null, 2));
    cb();
  });
}

function handleSendRequest(deps, ans) {
  if (ans.answer === askSendRequest.choices[0].value) {
    validate(deps.state, payload => {
      sendRequest(payload, ENDPOINT_URL, deps.ui, deps.requestId, () => {
        ui.updateBottomBar('');
        deps.prompts.next(askSendRequest);
      });
    });
  }
  if (ans.answer === askSendRequest.choices[1].value) {
    flushState(deps.state);
    delete deps.requestId;
    deps.prompts.next(askWhichEvent);
  }
}

function handleEventChoose(deps, ans) {
  deps.reduce(ans);
  deps.requestId = shortid.generate();
  const { questions } = mapEventIdToData(deps.state.eventId);
  const filteredQuestions = questions.filter(e => e.name !== 'eventId'); // filter val which is set by first question
  filteredQuestions.forEach(e => deps.prompts.next(e));
  if (filteredQuestions.length === 0) {
    validate(deps.state, () => deps.prompts.next(askSendRequest));
  }
}

function handleDefault(deps, ans) {
  deps.reduce(ans);
  validate(deps.state, () => deps.prompts.next(askSendRequest));
}

function handleAnswer(deps) {
  return ans => {
    switch (ans.name) {
      case askSendRequest.name:
        return handleSendRequest(deps, ans);
      case askWhichEvent.name:
        return handleEventChoose(deps, ans);
      default:
        return handleDefault(deps, ans);
    }
  };
}

const state = {};
const reduce = reducer(state);
const ui = new inquirer.ui.BottomBar();
ui.updateBottomBar('');
inquirer
  .prompt(prompts)
  .ui.process.subscribe(
    handleAnswer({ state, prompts, reduce, ui }),
    err => console.log('Error: ', err),
    () => console.log('Bye')
  );

prompts.next(askWhichEvent); // start action
