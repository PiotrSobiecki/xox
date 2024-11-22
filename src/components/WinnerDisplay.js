import styles from "../styles/Home.module.css";

export default function WinnerDisplay({ winner, player1, player2, onReset }) {
  return (
    <div className={styles.winnerDisplay}>
      <h2>
        {winner === "Remis" ? "Remis!" : `Gratulacje ${winner}! Wygrywasz!`}
      </h2>
      <button className={styles.resetButton} onClick={onReset}>
        Zagraj jeszcze raz!
      </button>
    </div>
  );
}
