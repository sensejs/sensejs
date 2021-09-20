import {uuidV1} from '../src/uuid';

test('uuidV1ClusterSafe', () => {
  expect(uuidV1()).not.toEqual(uuidV1());
});
