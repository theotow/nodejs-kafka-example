const {
  mustExists,
  mustBeCleanerOfJob,
  notYetAnswered,
  jobNotYetAccepted
} = require('./businessrules');

module.exports = {
  createJobRequest: {
    SCHEMA: {
      eventId: { type: 'string', equal: 'createJobRequest' },
      cleaners: { type: 'array', items: { type: 'string' } },
      jobRequestId: { type: 'string' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          props: {
            id: { type: 'string' },
            name: { type: 'string' },
            done: { type: 'boolean' }
          }
        }
      }
    },
    MOCK: ({}) => ({
      eventId: 'createJobRequest',
      cleaners: ['cleaner1', 'cleaner2'],
      jobRequestId: '_WILL_BE_REPLACED_BY_API_',
      tasks: [
        {
          id: 'task1',
          name: 'task1name',
          done: false
        }
      ]
    }),
    RULES: []
  },
  accepteJobRequest: {
    SCHEMA: {
      eventId: { type: 'string', equal: 'accepteJobRequest' },
      jobRequestId: { type: 'string' },
      cleanerId: { type: 'string' }
    },
    MOCK: ({ jobRequestId, cleanerId }) => ({
      eventId: 'accepteJobRequest',
      jobRequestId,
      cleanerId
    }),
    RULES: [mustExists, mustBeCleanerOfJob, notYetAnswered, jobNotYetAccepted]
  },
  declineJobRequest: {
    SCHEMA: {
      eventId: { type: 'string', equal: 'declineJobRequest' },
      jobRequestId: { type: 'string' },
      cleanerId: { type: 'string' }
    },
    MOCK: ({ jobRequestId, cleanerId }) => ({
      eventId: 'declineJobRequest',
      jobRequestId,
      cleanerId
    }),
    RULES: [mustExists, mustBeCleanerOfJob, notYetAnswered]
  }
  // startJobRequest: {
  //   eventId: { type: 'string', equal: 'startJobRequest' },
  //   jobRequestId: { type: 'string' }
  // },
  // finishJobRequestTask: {
  //   eventId: { type: 'string', equal: 'finishJobRequestTask' },
  //   jobRequestId: { type: 'string' },
  //   taskId: { type: 'string' }
  // },
  // finishJobRequest: {
  //   eventId: { type: 'string', equal: 'finishJobRequest' },
  //   jobRequestId: { type: 'string' }
  // }
};
