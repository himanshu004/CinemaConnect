// client.js (example)
import { io } from "socket.io-client";

// connect to your backend
const socket = io("http://localhost:5000", {
  transports: ["websocket"], // ensures websocket is used
});

// listen for connection
socket.on("connect", () => {
  console.log("Connected with id:", socket.id);
});

// listen for messages
socket.on("message", (msg) => {
  console.log("New message:", msg);
});

// send a message
socket.emit("message", "Hello from client!");
