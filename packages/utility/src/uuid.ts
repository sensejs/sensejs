import * as os from 'os';
import {v1 as uuid} from 'uuid';

const networkInterfaces = os.networkInterfaces();
const allMacAddresses = Object.values(networkInterfaces)
  .reduce((all, current) => all.concat(current), [])
  .filter((info) => !info.internal) // Filter out internal network interface
  .map((info) => info.mac)
  .filter((mac) => mac !== '00:00:00:00:00:00'); // Filter out virtual network interface

const uuidV1Suffixes = allMacAddresses.length === 0
  ? [Buffer.allocUnsafe(6)]
  : allMacAddresses.map((mac) => mac.replace(/:/g, '')).map((hex) => Buffer.from(hex, 'hex'));
const processStartupTime = Date.now();
const processStartupClock = process.hrtime();

export function uuidV1() {
  const [second, nano] = process.hrtime(processStartupClock);
  const milliParts = Math.trunc(nano / 1000000);
  const nanoRemains = nano - milliParts * 1000000;
  const milliseconds = second * 1000 + milliParts;

  return uuid({
    node: uuidV1Suffixes[nano % uuidV1Suffixes.length],
    msecs: processStartupTime + second + milliseconds,
    nsecs: Math.trunc(nanoRemains / 100),
  });
}
