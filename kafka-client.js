import { Kafka } from "kafkajs";

export const kafkaCient= new Kafka({
    clientId:"locationMap",
    brokers:['localhost:9092']
})