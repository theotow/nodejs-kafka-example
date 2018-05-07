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

module.exports = {
  getPartition
};
