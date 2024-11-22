import styles from "../styles/Home.module.css";

export default function PlayerInput({ value, onChange }) {
  return (
    <input
      className={styles.input}
      type="text"
      placeholder="Wpisz swoje imię"
      value={value}
      onChange={onChange}
    />
  );
}
