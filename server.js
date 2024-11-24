const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");
const cors = require("cors");
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const games = new Map();

nextApp.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  expressApp.use(
    cors({
      origin: [
        "https://xox-five.vercel.app",
        "http://localhost:3000",
        "https://xox.sobiecki.org",
      ],
      credentials: true,
    })
  );

  const io = new Server(server, {
    cors: {
      origin: [
        "https://xox-five.vercel.app",
        "http://localhost:3000",
        "https://xox.sobiecki.org",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Klient połączony:", socket.id);

    socket.on("createRoom", () => {
      const roomId = Math.random().toString(36).substring(7);
      socket.join(roomId);

      const gameState = {
        board: Array(9).fill(null),
        hostId: socket.id,
        guestId: null,
        selectedCharacters: {
          host: null,
          guest: null,
        },
        currentTurn: socket.id,
      };

      games.set(roomId, gameState);
      socket.emit("roomCreated", { roomId, isHost: true });
    });

    socket.on("setInitialCharacters", ({ roomId, character1, character2 }) => {
      console.log("Ustawianie początkowych charakterów:", {
        roomId,
        character1,
        character2,
      });
      const gameState = games.get(roomId);
      if (!gameState) return;

      gameState.selectedCharacters.host = character1;
      gameState.selectedCharacters.guest = character2;
      games.set(roomId, gameState);

      io.to(roomId).emit("charactersUpdate", {
        character1: gameState.selectedCharacters.host,
        character2: gameState.selectedCharacters.guest,
      });
    });

    socket.on("joinRoom", (roomId) => {
      const gameState = games.get(roomId);
      if (!gameState) return;

      socket.join(roomId);
      gameState.guestId = socket.id;
      games.set(roomId, gameState);

      console.log("Gracz dołącza do pokoju:", {
        roomId,
        characters: gameState.selectedCharacters,
      });

      // Wysyłamy stan do dołączającego gracza
      socket.emit("joinedRoom", {
        roomId,
        isHost: false,
        players: [
          { id: gameState.hostId, isX: true },
          { id: socket.id, isX: false },
        ],
        character1: gameState.selectedCharacters.host,
        character2: gameState.selectedCharacters.guest,
      });

      // Informujemy wszystkich o rozpoczęciu gry
      io.to(roomId).emit("gameStart", {
        players: [
          { id: gameState.hostId, isX: true },
          { id: socket.id, isX: false },
        ],
        currentTurn: gameState.currentTurn,
        board: gameState.board,
        character1: gameState.selectedCharacters.host,
        character2: gameState.selectedCharacters.guest,
      });
    });

    socket.on("characterSelected", ({ roomId, character, isHost }) => {
      console.log("Wybór charakteru:", { roomId, character, isHost });
      const gameState = games.get(roomId);
      if (!gameState) return;

      if (isHost) {
        gameState.selectedCharacters.host = character;
      } else {
        gameState.selectedCharacters.guest = character;
      }
      games.set(roomId, gameState);

      io.to(roomId).emit("charactersUpdate", {
        character1: gameState.selectedCharacters.host,
        character2: gameState.selectedCharacters.guest,
      });
    });

    socket.on("makeMove", ({ roomId, index }) => {
      const gameState = games.get(roomId);
      if (!gameState || gameState.currentTurn !== socket.id) return;

      const isHost = socket.id === gameState.hostId;
      const newBoard = [...gameState.board];
      newBoard[index] = isHost ? "1" : "2";

      gameState.board = newBoard;
      gameState.currentTurn = isHost ? gameState.guestId : gameState.hostId;
      games.set(roomId, gameState);

      io.to(roomId).emit("updateGame", {
        board: newBoard,
        currentTurn: gameState.currentTurn,
      });
    });

    socket.on("playerNameUpdated", ({ player, name }) => {
      const [roomId] = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );
      if (!roomId) return;

      io.to(roomId).emit("playerNameUpdated", { player, name });
    });

    socket.on("resetGame", ({ roomId }) => {
      const gameState = games.get(roomId);
      if (!gameState) return;

      gameState.board = Array(9).fill(null);
      gameState.currentTurn = gameState.hostId;
      games.set(roomId, gameState);

      io.to(roomId).emit("updateGame", {
        board: Array(9).fill(null),
        currentTurn: gameState.hostId,
      });
    });

    socket.on("disconnect", () => {
      console.log("Klient rozłączony:", socket.id);
      for (const [roomId, gameState] of games.entries()) {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (!room || room.size === 0) {
          games.delete(roomId);
        }
      }
    });
  });

  expressApp.all("*", (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
