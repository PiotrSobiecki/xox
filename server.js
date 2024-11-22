const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
// Przechowywanie stanu gier
const games = new Map();
app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  io.on("connection", (socket) => {
    console.log("Klient połączony:", socket.id);
    socket.on("createRoom", () => {
      const roomId = Math.random().toString(36).substring(7);
      socket.join(roomId);
      const players = [
        {
          id: socket.id,
          isX: true,
        },
      ];
      // Inicjalizacja stanu gry dla nowego pokoju
      games.set(roomId, {
        board: Array(9).fill(null),
        currentTurn: socket.id,
      });
      socket.emit("roomCreated", {
        roomId,
        players,
        isHost: true,
      });
      console.log("Utworzono pokój:", {
        roomId,
        players,
      });
    });
    socket.on("joinRoom", (roomId) => {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size < 2) {
        socket.join(roomId);
        // Pobierz wszystkich graczy w pokoju po dołączeniu nowego
        const allPlayers = Array.from(io.sockets.adapter.rooms.get(roomId));
        const players = allPlayers.map((id) => ({
          id,
          isX: id === allPlayers[0], // pierwszy gracz (host) jest X
        }));
        // Wyślij informację o dołączeniu do pokoju
        socket.emit("joinedRoom", {
          roomId,
          players,
          isHost: false,
        });
        // Powiadom wszystkich w pokoju o rozpoczęciu gry
        io.to(roomId).emit("gameStart", {
          players,
          currentTurn: players[0].id,
          board: games.get(roomId)?.board || Array(9).fill(null),
        });
        console.log("Gracz dołączył do pokoju:", {
          roomId,
          players,
          currentTurn: players[0].id,
        });
      } else {
        socket.emit("roomError", "Pokój jest pełny lub nie istnieje");
      }
    });
    socket.on("makeMove", ({ roomId, index }) => {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room) return;
      const gameState = games.get(roomId);
      if (!gameState || gameState.currentTurn !== socket.id) return;
      const players = Array.from(room).map((id) => ({
        id,
        isX: id === Array.from(room)[0],
      }));
      const newBoard = [...gameState.board];
      const isPlayerX = players.find((p) => p.id === socket.id)?.isX;
      // Zmiana tutaj - zamiast "X" i "O" używamy "1" i "2"
      newBoard[index] = isPlayerX ? "1" : "2";
      const nextPlayer = players.find((p) => p.id !== socket.id);
      games.set(roomId, {
        board: newBoard,
        currentTurn: nextPlayer.id,
      });
      io.to(roomId).emit("updateGame", {
        board: newBoard,
        currentTurn: nextPlayer.id,
      });
    });
    socket.on("updatePlayer", ({ player, name, character }) => {
      const [roomId] = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );
      if (!roomId) return;
      io.to(roomId).emit("playerUpdated", {
        player,
        name,
        character,
      });
    });
    socket.on("resetGame", ({ roomId }) => {
      if (!games.has(roomId)) return;
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room) return;
      const players = Array.from(room).map((id) => ({
        id,
        isX: id === Array.from(room)[0],
      }));
      games.set(roomId, {
        board: Array(9).fill(null),
        currentTurn: players[0].id,
      });
      io.to(roomId).emit("updateGame", {
        board: Array(9).fill(null),
        currentTurn: players[0].id,
      });
    });
    socket.on("disconnect", () => {
      console.log("Klient rozłączony:", socket.id);
      // Opcjonalnie: Możesz dodać czyszczenie pokoi po rozłączeniu gracza
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
