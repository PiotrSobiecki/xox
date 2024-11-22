"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io as socketIO } from "socket.io-client";
import Board from "../components/Board";
import PlayerInput from "../components/PlayerInput";
import WinnerDisplay from "../components/WinnerDisplay";
import styles from "../styles/Home.module.css";

export default function Home() {
  const characters = [
    { name: "Erosin Worm", image: "/images/ErosimWorm.png" },
    { name: "Bloop", image: "/images/Bloop.png" },
    { name: "Huggy Wuggy", image: "/images/huggy.png" },
    { name: "Dam Seek", image: "/images/damseek.jpg" },
    { name: "Figure", image: "/images/figure.png" },
    { name: "Noob", image: "/images/noob.png" },
    { name: "Pikachu", image: "/images/pikachu.png" },
    { name: "Dragon Land", image: "/images/dragon.jpg" },
    { name: "See Eather", image: "/images/seeather.png" },
    { name: "Bacon", image: "/images/bacon.png" },
  ];

  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [playerRole, setPlayerRole] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [character1, setCharacter1] = useState(characters[0].name);
  const [character2, setCharacter2] = useState(characters[1].name);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [winner, setWinner] = useState(null);

  const getRandomCharacter = (excludeCharacter = "") => {
    const availableCharacters = characters.filter(
      (char) => char.name !== excludeCharacter
    );
    const randomIndex = Math.floor(Math.random() * availableCharacters.length);
    return availableCharacters[randomIndex].name;
  };

  const createRoom = useCallback(() => {
    console.log("Próba utworzenia pokoju...");
    if (!socketRef.current) {
      alert("Nie można połączyć z serwerem!");
      return;
    }
    socketRef.current.emit("createRoom");
  }, []);

  const joinRoom = useCallback((roomId) => {
    console.log("Próba dołączenia do pokoju:", roomId);
    if (!socketRef.current) {
      alert("Nie można połączyć z serwerem!");
      return;
    }
    socketRef.current.emit("joinRoom", roomId);
  }, []);

  const handleClick = useCallback(
    (index) => {
      if (!socketRef.current || !isMyTurn || board[index] || winner) return;
      socketRef.current.emit("makeMove", { roomId, index });
    },
    [isMyTurn, board, winner, roomId]
  );

  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (
        squares[a] &&
        squares[a] === squares[b] &&
        squares[a] === squares[c]
      ) {
        // Zmiana tutaj - dostosowanie do wartości "1" i "2"
        const winner =
          squares[a] === "1" ? player1 || "Gracz 1" : player2 || "Gracz 2";
        setWinner(winner);
        return;
      }
    }

    if (!squares.includes(null)) {
      setWinner("Remis");
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsMyTurn(true);
    setWinner(null);
    socketRef.current?.emit("resetGame", { roomId });
  };

  useEffect(() => {
    const socket = socketIO("http://localhost:3000", {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log("Połączono z serwerem:", socket.id);
      setIsConnected(true);
    });

    socket.on("roomCreated", ({ roomId, players, isHost }) => {
      console.log("Utworzono pokój:", roomId);
      setRoomId(roomId);
      setIsHost(true);
      setIsMyTurn(true);
      setPlayerRole("X");
    });

    socket.on("joinedRoom", ({ roomId, players, isHost }) => {
      console.log("Dołączono do pokoju:", { roomId, players, isHost });
      setRoomId(roomId);
      setIsHost(isHost);
      const player = players.find((p) => p.id === socket.id);
      if (player) {
        setPlayerRole(player.isX ? "X" : "O");
        setIsMyTurn(player.isX);
      }
    });

    socket.on("gameStart", ({ players, currentTurn, board }) => {
      console.log("Gra rozpoczęta:", { players, currentTurn, board });
      const player = players.find((p) => p.id === socket.id);
      if (player) {
        setPlayerRole(player.isX ? "X" : "O");
        setIsMyTurn(currentTurn === socket.id);
        setIsHost(player.isX);
        if (board) setBoard(board);
      }
    });

    socket.on("updateGame", ({ board: newBoard, currentTurn }) => {
      console.log("Aktualizacja gry:", { newBoard, currentTurn });
      setBoard(newBoard);
      setIsMyTurn(currentTurn === socket.id);
      checkWinner(newBoard);
    });

    socket.on("playerUpdated", ({ player, name, character }) => {
      console.log("Aktualizacja gracza:", { player, name, character });
      if (player === 1) {
        setPlayer1(name);
        setCharacter1(character);
      } else {
        setPlayer2(name);
        setCharacter2(character);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Gra w Kółko i Krzyżyk! 🎮</h1>

      {!isConnected && (
        <div className={styles.error}>Łączenie z serwerem...</div>
      )}

      {isConnected && !roomId && (
        <div className={styles.menuButtons}>
          <button onClick={createRoom}>Stwórz pokój</button>
          <button
            onClick={() => {
              const id = prompt("Podaj ID pokoju:");
              if (id) joinRoom(id);
            }}
          >
            Dołącz do pokoju
          </button>
        </div>
      )}

      {isConnected && roomId && (
        <>
          <div className={styles.gameInfo}>
            <div>ID Pokoju: {roomId}</div>
            {playerRole && <div>Grasz jako: {playerRole}</div>}
          </div>

          <div className={styles.playerInputs}>
            <div className={styles.playerSection}>
              <div className={styles.inputsContainer}>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Wpisz swoje imię"
                  value={player1}
                  onChange={(e) => {
                    setPlayer1(e.target.value);
                    socketRef.current?.emit("updatePlayer", {
                      player: 1,
                      name: e.target.value,
                      character: character1,
                    });
                  }}
                  disabled={!isHost}
                />
                <select
                  className={styles.characterSelect}
                  value={character1}
                  onChange={(e) => {
                    setCharacter1(e.target.value);
                    if (e.target.value === character2) {
                      const newChar = getRandomCharacter(e.target.value);
                      setCharacter2(newChar);
                    }
                    socketRef.current?.emit("updatePlayer", {
                      player: 1,
                      name: player1,
                      character: e.target.value,
                    });
                  }}
                  disabled={!isHost}
                >
                  {characters.map((character) => (
                    <option
                      key={character.name}
                      value={character.name}
                      disabled={character.name === character2}
                    >
                      {character.name}
                    </option>
                  ))}
                </select>
              </div>
              <img
                src={characters.find((c) => c.name === character1)?.image}
                alt={character1}
                className={styles.characterImage}
              />
            </div>

            <div className={styles.playerSection}>
              <div className={styles.inputsContainer}>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Wpisz swoje imię"
                  value={player2}
                  onChange={(e) => {
                    setPlayer2(e.target.value);
                    socketRef.current?.emit("updatePlayer", {
                      player: 2,
                      name: e.target.value,
                      character: character2,
                    });
                  }}
                  disabled={isHost}
                />
                <select
                  className={styles.characterSelect}
                  value={character2}
                  onChange={(e) => {
                    setCharacter2(e.target.value);
                    if (e.target.value === character1) {
                      const newChar = getRandomCharacter(e.target.value);
                      setCharacter1(newChar);
                    }
                    socketRef.current?.emit("updatePlayer", {
                      player: 2,
                      name: player2,
                      character: e.target.value,
                    });
                  }}
                  disabled={isHost}
                >
                  {characters.map((character) => (
                    <option
                      key={character.name}
                      value={character.name}
                      disabled={character.name === character1}
                    >
                      {character.name}
                    </option>
                  ))}
                </select>
              </div>
              <img
                src={characters.find((c) => c.name === character2)?.image}
                alt={character2}
                className={styles.characterImage}
              />
            </div>
          </div>

          <div className={styles.playerTurn}>
            Teraz gra: {isMyTurn ? player1 || "Gracz 1" : player2 || "Gracz 2"}
          </div>

          <Board
            board={board}
            onSquareClick={handleClick}
            character1={character1}
            character2={character2}
            characters={characters}
          />

          {winner && (
            <WinnerDisplay
              winner={winner}
              player1={player1 || "Gracz 1"}
              player2={player2 || "Gracz 2"}
              onReset={resetGame}
            />
          )}
        </>
      )}
    </div>
  );
}
