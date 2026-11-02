const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");
const cors = require("cors");
const crypto = require("crypto");
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const games = new Map();

// Walidacja danych od klienta: socket.io przyjmuje dowolny JSON, więc bez
// tych sprawdzeń gracz mógł nadpisać zajęte pole, dołączyć do cudzego
// pokoju jako "gość" albo rozgłaszać dowolnie długie ciągi.
const MAX_NAME_LENGTH = 30;
const MAX_CHARACTER_LENGTH = 40;

function isRoomId(value) {
  return typeof value === "string" && /^[a-z0-9]{1,16}$/.test(value);
}

function isBoardIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 8;
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function isPlayer(gameState, socketId) {
  return socketId === gameState.hostId || socketId === gameState.guestId;
}

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
      // 32 bity losowości zamiast 4-5 znaków z Math.random (zgadywalne).
      const roomId = crypto.randomBytes(4).toString("hex");
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

    socket.on("setInitialCharacters", (payload) => {
      const { roomId } = payload || {};
      const character1 = cleanText(payload?.character1, MAX_CHARACTER_LENGTH);
      const character2 = cleanText(payload?.character2, MAX_CHARACTER_LENGTH);
      if (!isRoomId(roomId) || !character1 || !character2) return;
      const gameState = games.get(roomId);
      if (!gameState || gameState.hostId !== socket.id) return;

      gameState.selectedCharacters.host = character1;
      gameState.selectedCharacters.guest = character2;
      games.set(roomId, gameState);

      io.to(roomId).emit("charactersUpdate", {
        character1: gameState.selectedCharacters.host,
        character2: gameState.selectedCharacters.guest,
      });
    });

    socket.on("joinRoom", (roomId) => {
      if (!isRoomId(roomId)) return;
      const gameState = games.get(roomId);
      if (!gameState) return;
      // Pokój ma jednego gościa; host nie może dołączyć do siebie.
      if (gameState.guestId || gameState.hostId === socket.id) return;

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

    socket.on("characterSelected", (payload) => {
      const { roomId } = payload || {};
      const character = cleanText(payload?.character, MAX_CHARACTER_LENGTH);
      if (!isRoomId(roomId) || !character) return;
      const gameState = games.get(roomId);
      if (!gameState || !isPlayer(gameState, socket.id)) return;

      // Rolę bierzemy z serwera, nie z flagi isHost przysłanej przez klienta.
      const isHost = socket.id === gameState.hostId;
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

    socket.on("makeMove", (payload) => {
      const { roomId, index } = payload || {};
      if (!isRoomId(roomId) || !isBoardIndex(index)) return;
      const gameState = games.get(roomId);
      if (!gameState || gameState.currentTurn !== socket.id) return;
      if (!gameState.guestId || gameState.board[index] !== null) return;

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

    socket.on("playerNameUpdated", (payload) => {
      const { player } = payload || {};
      // Puste imię jest dozwolone (gracz czyści pole), ale musi być stringiem.
      const name = typeof payload?.name === "string" ? payload.name.trim() : null;
      if (name === null || name.length > MAX_NAME_LENGTH) return;
      if (player !== 1 && player !== 2) return;
      const [roomId] = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );
      if (!roomId) return;

      io.to(roomId).emit("playerNameUpdated", { player, name });
    });

    socket.on("resetGame", (payload) => {
      const { roomId } = payload || {};
      if (!isRoomId(roomId)) return;
      const gameState = games.get(roomId);
      if (!gameState || !isPlayer(gameState, socket.id)) return;

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
