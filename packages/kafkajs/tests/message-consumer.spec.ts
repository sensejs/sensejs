class MockKafka {
  admin() {
    return {
      fetchTopicMetadata: jest.fn(),
    };
  }

  consumer() {
    return {
      subscribe: jest.fn(),
      run() {

      }
    };
  }
}

jest.mock('kafkajs', () => {
  return {
    Kafka: MockKafka,
  };
});
