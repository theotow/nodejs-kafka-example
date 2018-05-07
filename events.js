module.exports = {
  createJobRequest: {
    eventId: { type: 'string', equal: 'createJobRequest' },
    cleaners: { type: 'array', items: { type: 'string' } },
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
  accepteJobRequest: {
    eventId: { type: 'string', equal: 'accepteJobRequest' },
    jobRequestId: { type: 'string' },
    cleanerId: { type: 'string' }
  },
  declineJobRequest: {
    eventId: { type: 'string', equal: 'declineJobRequest' },
    jobRequestId: { type: 'string' },
    cleanerId: { type: 'string' }
  },
  startJobRequest: {
    eventId: { type: 'string', equal: 'startJobRequest' },
    jobRequestId: { type: 'string' }
  },
  finishJobRequestTask: {
    eventId: { type: 'string', equal: 'finishJobRequestTask' },
    jobRequestId: { type: 'string' },
    taskId: { type: 'string' }
  },
  finishJobRequest: {
    eventId: { type: 'string', equal: 'finishJobRequest' },
    jobRequestId: { type: 'string' }
  }
};
