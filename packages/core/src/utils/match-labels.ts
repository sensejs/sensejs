import lodash from 'lodash';

export function matchLabels(
  labels: Set<string | symbol>,
  condition?: (string | symbol)[] | Set<string | symbol> | ((labels: Set<string | symbol>) => boolean),
): boolean {
  if (typeof condition === 'function') {
    return condition(labels);
  }

  const matchLabels = new Set(condition);
  const intersectedLabels = lodash.intersection([...matchLabels], [...labels]);

  return intersectedLabels.length === matchLabels.size;
}
