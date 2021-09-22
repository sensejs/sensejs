import {uuidV1} from '../src/uuid.js';

test('uuidV1ClusterSafe', () => {
  expect(uuidV1()).not.toEqual(uuidV1());
});
