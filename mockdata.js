module.exports = {
  createJobRequest: ({ }) => ({
    eventId: 'createJobRequest',
    cleaners: ['cleaner1', 'cleaner2'],
    tasks: [
      {
        id: "task1",
        name: "task1name",
        done: false
      }
    ]
  }),
  accepteJobRequest: ({ jobRequestId, cleanerId }) => ({
    eventId: 'accepteJobRequest',
    jobRequestId,
    cleanerId
  }),
  declineJobRequest: ({ jobRequestId, cleanerId }) => ({
    eventId: 'declineJobRequest',
    jobRequestId,
    cleanerId
  }),
  startJobRequest: ({ jobRequestId }) => ({
    eventId: 'startJobRequest',
    jobRequestId,
  }),
  finishJobRequestTask: ({ jobRequestId, taskId }) => ({
    eventId: 'finishJobRequestTask',
    jobRequestId,
    taskId
  }),
  finishJobRequest: ({ jobRequestId }) => ({
    eventId: 'finishJobRequest',
    jobRequestId,
  }),
};
