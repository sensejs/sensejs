import {getModuleMetadata, ModuleMetadata} from './module';
import {Constructor} from './interfaces';

export class ModuleScanner {
  public constructor(private entryModule: Constructor) {}

  scanModule(callback: (metadata: ModuleMetadata) => void): void {
    const visitedModules = new Set<Constructor>();
    const queue: Constructor[] = [this.entryModule];
    for (;;) {
      const moduleToVisit = queue.pop();
      if (typeof moduleToVisit === 'undefined') {
        return;
      }
      if (visitedModules.has(moduleToVisit)) {
        continue;
      }
      const metadata = getModuleMetadata(moduleToVisit);

      for (const dependency of metadata.requires) {
        if (!visitedModules.has(dependency)) {
          queue.push(dependency);
        }
      }

      callback(metadata);
      visitedModules.add(moduleToVisit);
    }
  }
}
