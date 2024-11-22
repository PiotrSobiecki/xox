import styles from "../styles/Home.module.css";

export default function Board({
  board,
  onSquareClick,
  character1,
  character2,
  characters,
}) {
  const renderSquare = (index) => {
    const value = board[index];
    let image = null;

    if (value === "1") {
      image = characters.find((c) => c.name === character1)?.image;
    } else if (value === "2") {
      image = characters.find((c) => c.name === character2)?.image;
    }

    return (
      <button className={styles.square} onClick={() => onSquareClick(index)}>
        {image && (
          <img
            src={image}
            alt={value === "1" ? "Gracz 1" : "Gracz 2"}
            className={styles.characterImage}
          />
        )}
      </button>
    );
  };

  return (
    <div className={styles.board}>
      <div className={styles.boardRow}>
        {renderSquare(0)}
        {renderSquare(1)}
        {renderSquare(2)}
      </div>
      <div className={styles.boardRow}>
        {renderSquare(3)}
        {renderSquare(4)}
        {renderSquare(5)}
      </div>
      <div className={styles.boardRow}>
        {renderSquare(6)}
        {renderSquare(7)}
        {renderSquare(8)}
      </div>
    </div>
  );
}
