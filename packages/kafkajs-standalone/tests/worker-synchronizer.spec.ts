import {jest} from '@jest/globals';
import {WorkerController} from '../src/index.js';
import {Subject} from 'rxjs';

describe('WorkerSynchronization', () => {
  test('no synchronization', async () => {
    const controller = new WorkerController();
    const worker = controller.createSynchronizer();
    const stub = jest.fn(async () => void 0);
    await worker.checkSynchronized(stub);
    worker.detach();
    expect(stub).not.toHaveBeenCalled();
  });

  test('no worker', async () => {
    const controller = new WorkerController();
    const stub = jest.fn(async () => void 0) as () => Promise<void>;
    controller.synchronize(stub);
    expect(stub).toHaveBeenCalledTimes(1);

    const worker = controller.createSynchronizer();
    await worker.checkSynchronized(stub);
    worker.detach();
    controller.synchronize(stub);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  test('synchronize', async () => {
    const controller = new WorkerController<boolean>();

    const worker1 = controller.createSynchronizer(false);
    const worker2 = controller.createSynchronizer(false);
    const worker3 = controller.createSynchronizer(false);

    const workerSubject1 = new Subject<void>();
    const workerSubject2 = new Subject<void>();
    const workerSubject3 = new Subject<void>();

    const workerStub1 = jest.fn(() => workerSubject1.toPromise());
    const workerStub2 = jest.fn(() => workerSubject2.toPromise());
    const workerStub3 = jest.fn(() => workerSubject3.toPromise());

    const controllerSynchronizedSubject = new Subject<void>();
    const controllerStubCalled = new Subject();
    const controllerStub = jest.fn(async () => {
      controllerStubCalled.complete();
      await controllerSynchronizedSubject.toPromise();
      return true;
    });
    expect(controller.synchronize(controllerStub)).toBe(true);

    expect(controllerStub).not.toHaveBeenCalled();
    const workerPromise1 = worker1.checkSynchronized(workerStub1);
    const workerPromise2 = worker2.checkSynchronized(workerStub2);
    expect(controller.synchronize(controllerStub)).toBe(false);

    expect(workerStub1).toHaveBeenCalled();
    expect(workerStub2).toHaveBeenCalled();

    workerSubject1.complete();
    expect(controllerStub).not.toHaveBeenCalled();

    workerSubject2.complete();
    expect(controllerStub).not.toHaveBeenCalled();

    const workerPromise3 = worker3.checkSynchronized(workerStub3);
    expect(controllerStub).not.toHaveBeenCalled();
    workerSubject3.complete();

    await controllerStubCalled.toPromise();
    controllerSynchronizedSubject.complete();

    await expect(Promise.all([workerPromise1, workerPromise2, workerPromise3])).resolves.toEqual([true, true, true]);
  });
});
