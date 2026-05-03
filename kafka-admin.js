import { kafkaCient } from "./kafka-client.js";

export async function kafkaSetup() {
  const admin = kafkaCient.admin();
  await admin.connect();

  await admin.createTopics({
    topics: [{ topic: "location_updates", numPartitions: 2 }],
  });

  await admin.disconnect()
}

kafkaSetup()