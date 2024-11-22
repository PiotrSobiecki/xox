import { Server } from "socket.io";

const games = new Map();

const ioHandler = (req) => {
  if (!req.socket.server.io) {
    console.log("Inicjalizacja Socket.IO...");
    const io = new Server(req.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
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
        const players = [{ id: socket.id, isX: true }];
        games.set(roomId, {
          board: Array(9).fill(null),
          currentTurn: socket.id,
        });
        socket.emit("roomCreated", { roomId, players, isHost: true });
        console.log("Utworzono pokój:", { roomId, players });
      });

      socket.on("joinRoom", (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size < 2) {
          socket.join(roomId);
          const allPlayers = Array.from(io.sockets.adapter.rooms.get(roomId));
          const players = allPlayers.map((id) => ({
            id,
            isX: id === allPlayers[0],
          }));

          socket.emit("joinedRoom", {
            roomId,
            players,
            isHost: false,
          });

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
        for (const [roomId, gameState] of games.entries()) {
          const room = io.sockets.adapter.rooms.get(roomId);
          if (!room || room.size === 0) {
            games.delete(roomId);
          }
        }
      });
    });

    req.socket.server.io = io;
  }
  return new Response("Socket.IO server running");
};

export const GET = ioHandler;
export const POST = ioHandler;
