type CallbackOutput<Output> = (data: Output) => void | Promise<void>;
type CallbackInput<Input> = (data: Input) => void | Promise<void>;

type EventEmitterOutput<Output> = {
  on: (callback: CallbackOutput<Output>) => void | Promise<void>;
  emit: CallbackInput<Output>;
};

type ListenEvent<Output> = {
  [key: number]: CallbackOutput<Output>;
};

class EventEmitter<Output> implements EventEmitterOutput<Output> {
  private listen: ListenEvent<Output> = {};

  private getId = () => {
    let id = 0;
    while (id in this.listen) id++;
    return id;
  };

  on = (callback: CallbackOutput<Output>) => {
    const id = this.getId();
    this.listen[id] = callback;
  };

  emit: CallbackInput<Output> = (data) => {
    const keys = Object.keys(this.listen);
    for (let indexListen = 0; indexListen < keys.length; indexListen++) {
      const callback = this.listen[Number(keys[indexListen])];
      Promise.resolve(callback.call(null, data));
    }
  };
}

export default EventEmitter;
