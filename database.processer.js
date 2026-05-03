import { kafkaCient } from "./kafka-client.js";

async function databaseConsumer() {
  const kafkaConsumer = kafkaCient.consumer({
    groupId: `database-server`,
  });

  await kafkaConsumer.connect();
  kafkaConsumer.subscribe({
    topic: "location_updates",
    fromBeginning: true,
  });
  kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const data = JSON.parse(message.value.toString());
      console.log("Kafka data received", { data });
      // io.emit("server:location_update", data);
      await heartbeat();
    },
  });
}
databaseConsumer()