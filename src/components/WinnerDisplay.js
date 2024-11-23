import styles from "../styles/Home.module.css";

export default function WinnerDisplay({
  winner,
  player1,
  player2,
  onReset,
  isHost,
}) {
  const getWinnerMessage = () => {
    if (winner === "Remis") return "Remis!";

    // Sprawdzamy, kto faktycznie wygrał
    const isPlayer1Winner = winner === "1";

    // Jeśli jesteśmy hostem (gracz 1)
    if (isHost) {
      if (isPlayer1Winner) {
        return `Gratulacje! Wygrałeś!`;
      } else {
        return `Niestety Przegrałeś!`;
      }
    }
    // Jeśli nie jesteśmy hostem (gracz 2)
    else {
      if (!isPlayer1Winner) {
        return `Gratulacje! Wygrałeś!`;
      } else {
        return `Niestety Przegrałeś!`;
      }
    }
  };

  return (
    <div className={styles.winnerDisplay}>
      <h2>{getWinnerMessage()}</h2>
      <button className={styles.resetButton} onClick={onReset}>
        Zagraj jeszcze raz!
      </button>
    </div>
  );
}
