function throwIf(val, error) {
  if (val) throw error;
}

function BusinessError(msg) {
  return new Error(msg);
}

const mustExists = (payload, agg) => throwIf(!agg, BusinessError('NOT_FOUND'));
const mustBeCleanerOfJob = (payload, agg) =>
  throwIf(
    agg.cleaners.indexOf(payload.cleanerId) === -1,
    BusinessError('MUST_BE_CLEANER_OF_JOB')
  );
const notYetAnswered = (payload, agg) => {
  throwIf(
    agg.answers[payload.cleanerId],
    BusinessError('YOU_ALREADY_ANSWERED')
  );
};
const jobNotYetAccepted = (payload, agg) => {
  throwIf(agg.acceptedCleaner, BusinessError('JOB_ALREADY_ACCEPTED'));
};

module.exports = {
  mustExists,
  mustBeCleanerOfJob,
  notYetAnswered,
  jobNotYetAccepted
};
